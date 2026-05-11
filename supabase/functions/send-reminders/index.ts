/**
 * Supabase Edge Function: send-reminders
 *
 * Scheduled via Supabase pg_cron (runs every minute).
 * Finds Horizon tasks with reminders due in the current IST minute window,
 * sends FCM push notifications, and logs each dispatch to prevent duplicates.
 *
 * Cron setup in Supabase SQL Editor:
 *   select cron.schedule(
 *     'send-horizon-reminders',
 *     '* * * * *',
 *     $$
 *       select net.http_post(
 *         url    := '<SUPABASE_FUNCTIONS_URL>/send-reminders',
 *         headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}',
 *         body   := '{}'
 *       );
 *     $$
 *   );
 *
 * Required Supabase secrets (set via Dashboard → Settings → Edge Functions):
 *   FIREBASE_SERVICE_ACCOUNT  — full JSON of a Firebase service account key
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Constants ────────────────────────────────────────────────────────────────

const IST_TIMEZONE = "Asia/Kolkata";

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

type HorizonTaskRow = {
  id: string;
  title: string;
  description: string | null;
  task_date: string;
  task_time: string;
};

type TokenRow = {
  token: string;
};

// ─── IST timezone helpers ─────────────────────────────────────────────────────

/**
 * Returns the current date and time broken into IST components.
 * Uses Intl.DateTimeFormat — no external libraries needed.
 */
function getISTComponents(date: Date): {
  dateStr: string;   // "YYYY-MM-DD"
  timeStr: string;   // "HH:MM"
  totalMinutes: number; // hours * 60 + minutes in IST
} {
  // en-CA gives YYYY-MM-DD date format natively
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    timeParts.find((p) => p.type === type)?.value ?? "00";

  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(hour)}:${pad(minute)}`;

  return {
    dateStr: datePart,
    timeStr,
    totalMinutes: hour * 60 + minute,
  };
}

/**
 * Converts total minutes (from midnight) into a "HH:MM" string.
 * Clamps to [00:00, 23:59].
 */
function minutesToTimeStr(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1439, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Base64url helper ────────────────────────────────────────────────────────

function toBase64url(data: string | Uint8Array): string {
  let base64: string;
  if (typeof data === "string") {
    base64 = btoa(unescape(encodeURIComponent(data)));
  } else {
    let binary = "";
    data.forEach((b) => (binary += String.fromCharCode(b)));
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ─── OAuth2 access token via service account JWT ─────────────────────────────

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = toBase64url(JSON.stringify(header));
  const payloadB64 = toBase64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const derBuffer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    derBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sigBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${toBase64url(new Uint8Array(sigBuffer))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`OAuth2 token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

// ─── Send one FCM message ─────────────────────────────────────────────────────

async function sendFCM(
  token: string,
  title: string,
  body: string,
  projectId: string,
  accessToken: string,
): Promise<boolean> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { url: "/horizon" },
        webpush: {
          notification: {
            icon: "/favicon.png",
            badge: "/favicon.png",
            tag: "horizon-reminder",
            requireInteraction: false,
          },
          fcm_options: { link: "/horizon" },
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[send-reminders] FCM send failed for token …${token.slice(-8)}: ${err}`);
    return false;
  }
  return true;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    // ── 1. Firebase service account ───────────────────────────────────────
    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountRaw) {
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT secret not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    const sa: ServiceAccount = JSON.parse(serviceAccountRaw);

    // ── 2. Supabase client ────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    // ── 3. Compute IST timing window ──────────────────────────────────────
    //
    // Tasks fire when:
    //   task_time >= (now_IST - 5 min)   ← up to 5 min overdue is OK
    //   task_time <= now_IST              ← not in the future
    //
    // This means the function catches any task that became due in the
    // last 5 minutes and hasn't been logged yet — safe for 1-min cron.

    const nowUTC = new Date();
    const ist = getISTComponents(nowUTC);

    // Window start = 5 minutes before current IST time
    const windowStartMinutes = ist.totalMinutes - 5;
    const windowStartStr = minutesToTimeStr(windowStartMinutes);
    const windowEndStr = ist.timeStr; // current IST time (inclusive)

    console.log(`[send-reminders] UTC now         : ${nowUTC.toISOString()}`);
    console.log(`[send-reminders] IST now          : ${ist.dateStr} ${ist.timeStr}`);
    console.log(`[send-reminders] IST date queried : ${ist.dateStr}`);
    console.log(`[send-reminders] Task time window : ${windowStartStr} – ${windowEndStr}`);

    // ── 4. Fetch tasks due in the IST window ──────────────────────────────
    const { data: tasks, error: tasksErr } = await db
      .from("horizon_tasks")
      .select("id, title, description, task_date, task_time")
      .eq("task_date", ist.dateStr)
      .eq("notification_enabled", true)
      .eq("completed", false)
      .gte("task_time", windowStartStr)
      .lte("task_time", windowEndStr);

    if (tasksErr) throw tasksErr;

    console.log(
      `[send-reminders] Tasks fetched  : ${tasks?.length ?? 0}`,
      tasks?.map((t: HorizonTaskRow) => `${t.task_time} "${t.title}"`),
    );

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({
          sent: 0,
          message: "No reminders due",
          debug: {
            istDate: ist.dateStr,
            istTime: ist.timeStr,
            window: `${windowStartStr}–${windowEndStr}`,
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // ── 5. Filter out already-sent reminders ──────────────────────────────
    const taskIds = (tasks as HorizonTaskRow[]).map((t) => t.id);

    const { data: alreadySent } = await db
      .from("reminder_sent_log")
      .select("task_id")
      .in("task_id", taskIds);

    const sentIds = new Set(
      (alreadySent ?? []).map((r: { task_id: string }) => r.task_id),
    );

    const pending = (tasks as HorizonTaskRow[]).filter((t) => {
      const due = !sentIds.has(t.id);
      if (!due) {
        console.log(
          `[send-reminders] Skipping task "${t.title}" (${t.task_time}) — already dispatched`,
        );
      }
      return due;
    });

    console.log(`[send-reminders] Pending (unsent): ${pending.length}`);

    if (pending.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "All reminders already dispatched" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // ── 6. Retrieve FCM tokens ────────────────────────────────────────────
    const { data: tokenRows, error: tokenErr } = await db
      .from("notification_tokens")
      .select("token");

    if (tokenErr) throw tokenErr;
    if (!tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No registered FCM tokens" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const tokens = (tokenRows as TokenRow[]).map((r) => r.token);
    console.log(`[send-reminders] FCM token count : ${tokens.length}`);

    // ── 7. Obtain OAuth2 access token once ───────────────────────────────
    const accessToken = await getAccessToken(sa);

    // ── 8. Dispatch notifications ─────────────────────────────────────────
    let sent = 0;
    const loggedIds: string[] = [];

    for (const task of pending) {
      console.log(
        `[send-reminders] Sending reminder for "${task.title}" (task_time=${task.task_time}, IST now=${ist.timeStr})`,
      );

      const results = await Promise.all(
        tokens.map((token) =>
          sendFCM(token, "Horizon Reminder", task.title, sa.project_id, accessToken)
        ),
      );

      const anySucceeded = results.some(Boolean);
      if (anySucceeded) {
        sent++;
        loggedIds.push(task.id);
        console.log(`[send-reminders] ✓ Sent reminder for "${task.title}"`);
      } else {
        console.warn(`[send-reminders] ✗ All FCM sends failed for "${task.title}"`);
      }
    }

    // ── 9. Log sent reminders (duplicate guard) ───────────────────────────
    if (loggedIds.length > 0) {
      await db
        .from("reminder_sent_log")
        .upsert(
          loggedIds.map((id) => ({ task_id: id })),
          { onConflict: "task_id", ignoreDuplicates: true },
        );
      console.log(`[send-reminders] Logged ${loggedIds.length} sent task(s) to reminder_sent_log`);
    }

    console.log(`[send-reminders] Done — dispatched ${sent} reminder(s)`);

    return new Response(
      JSON.stringify({
        sent,
        pending: pending.length,
        istTime: ist.timeStr,
        istDate: ist.dateStr,
        window: `${windowStartStr}–${windowEndStr}`,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-reminders] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
