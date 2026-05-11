/**
 * Supabase Edge Function: send-reminders
 *
 * Scheduled via Supabase pg_cron (see below) or called directly via HTTP.
 * Finds Horizon tasks with reminders due in the next 15 minutes,
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
 *                               (Firebase Console → Project Settings → Service Accounts → Generate new private key)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountRaw) {
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT secret not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const sa: ServiceAccount = JSON.parse(serviceAccountRaw);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    // ── Timing window: tasks due in the next 15 minutes ──────────────────
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);
    const todayDate = now.toISOString().slice(0, 10);

    const padTwo = (n: number) => String(n).padStart(2, "0");
    const nowTime = `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}`;
    const endTime = `${padTwo(windowEnd.getHours())}:${padTwo(windowEnd.getMinutes())}`;

    // ── Query tasks due in window ─────────────────────────────────────────
    const { data: tasks, error: tasksErr } = await db
      .from("horizon_tasks")
      .select("id, title, description, task_date, task_time")
      .eq("task_date", todayDate)
      .eq("notification_enabled", true)
      .eq("completed", false)
      .gte("task_time", nowTime)
      .lte("task_time", endTime);

    if (tasksErr) throw tasksErr;
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No reminders due" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Filter out already-sent reminders ────────────────────────────────
    const taskIds = (tasks as HorizonTaskRow[]).map((t) => t.id);

    const { data: alreadySent } = await db
      .from("reminder_sent_log")
      .select("task_id")
      .in("task_id", taskIds);

    const sentIds = new Set((alreadySent ?? []).map((r: { task_id: string }) => r.task_id));
    const pending = (tasks as HorizonTaskRow[]).filter((t) => !sentIds.has(t.id));

    if (pending.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "All reminders already dispatched" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Retrieve FCM tokens ───────────────────────────────────────────────
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

    // ── Obtain OAuth2 access token once ───────────────────────────────────
    const accessToken = await getAccessToken(sa);

    // ── Dispatch notifications ────────────────────────────────────────────
    let sent = 0;
    const loggedIds: string[] = [];

    for (const task of pending) {
      const title = "Horizon Reminder";
      const body = task.title;

      const results = await Promise.all(
        tokens.map((token) => sendFCM(token, title, body, sa.project_id, accessToken)),
      );

      const anySucceeded = results.some(Boolean);
      if (anySucceeded) {
        sent++;
        loggedIds.push(task.id);
      }
    }

    // ── Log sent reminders (duplicate guard) ─────────────────────────────
    if (loggedIds.length > 0) {
      await db
        .from("reminder_sent_log")
        .upsert(
          loggedIds.map((id) => ({ task_id: id })),
          { onConflict: "task_id", ignoreDuplicates: true },
        );
    }

    console.log(`[send-reminders] dispatched ${sent} reminder(s)`);

    return new Response(JSON.stringify({ sent, pending: pending.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-reminders] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
