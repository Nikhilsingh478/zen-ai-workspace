import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  useState, useCallback, useRef, useEffect, useMemo, memo
} from "react";
import {
  ChevronLeft, Sparkles, Loader2, CheckCircle2,
  TrendingUp, Zap, Target, Clock, Calendar, ChevronDown,
  ChevronUp, RotateCcw, Save, Trash2, BarChart3,
} from "lucide-react";
import { useTimeline, TIMELINE_MONTHS, DOMAINS, encodeTimelineDesc, type TimelineTask, type DomainId } from "@/lib/timeline";
import { addTasksBatch, deleteTasksByMonthKey } from "@/lib/horizon";
import type { HorizonTaskInput } from "@/lib/horizon";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/timeline")({
  component: TimelinePage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInRange(startStr: string, endStr: string): string[] {
  const days: string[] = [];
  const start = new Date(startStr);
  const end   = new Date(endStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const effectiveStart = start < today ? today : start;
  const d = new Date(effectiveStart);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function format12(time: string): string {
  const [h, min] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min).padStart(2, "0")} ${ampm}`;
}

function domainConfig(id: DomainId) {
  return DOMAINS.find((d) => d.id === id) ?? DOMAINS[0];
}

// ─── AI Schedule Generation ───────────────────────────────────────────────────

type RawTask = { title: string; startTime: string; endTime: string; domain: string };
type RawDay  = { date: string; tasks: RawTask[] };

function robustParseSchedule(raw: string): { days: RawDay[] } {
  let s = raw.trim();
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) s = fenceMatch[1].trim();
  const braceStart = s.indexOf("{");
  const braceEnd   = s.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1) s = s.slice(braceStart, braceEnd + 1);
  try { return JSON.parse(s) as { days: RawDay[] }; } catch { /* fall through */ }
  const repaired = s.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(repaired) as { days: RawDay[] }; } catch { /* fall through */ }
  const days: RawDay[] = [];
  const dayRe = /\{\s*"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"\s*,\s*"tasks"\s*:\s*(\[[\s\S]*?\])\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = dayRe.exec(repaired)) !== null) {
    try {
      const tasksJson = m[2].replace(/,(\s*[}\]])/g, "$1");
      const tasks = JSON.parse(tasksJson) as RawTask[];
      days.push({ date: m[1], tasks });
    } catch { /* skip malformed day */ }
  }
  if (days.length > 0) return { days };
  throw new Error("Could not parse AI schedule response — please try again");
}

async function generateScheduleWithGemini(context: string, monthKey: string): Promise<RawDay[]> {
  const month = TIMELINE_MONTHS.find((m) => m.key === monthKey)!;
  const today = new Date().toISOString().slice(0, 10);
  const effectiveStart = month.start < today ? today : month.start;
  const validDomains = DOMAINS.map((d) => d.id).join(", ");
  const start = new Date(effectiveStart);
  const end   = new Date(month.end);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  const prompt = `You are a personal life-scheduler AI. Generate a structured daily schedule for ${month.label} ${month.year}.

SCHEDULING RANGE: ${effectiveStart} to ${month.end} (${dayCount} days total)
Generate exactly one entry per day for every date from ${effectiveStart} to ${month.end}.

USER'S MONTHLY GOALS AND ROUTINE:
${context}

VALID DOMAIN IDs (use EXACTLY as written): ${validDomains}

OUTPUT FORMAT — respond with ONLY the following JSON, no markdown, no explanation, no text before or after:
{"days":[{"date":"YYYY-MM-DD","tasks":[{"title":"Task name","startTime":"HH:MM","endTime":"HH:MM","domain":"domain_id"}]}]}

RULES:
1. Every date from ${effectiveStart} to ${month.end} must appear exactly once
2. 24-hour time format only (e.g. "06:30", "22:00")
3. domain must be exactly one of: ${validDomains}
4. 3-5 tasks per day based on the user's routine
5. Base tasks on the user's actual stated goals and schedule
6. No trailing commas, no comments — valid JSON only`;

  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? "") as string;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192, topK: 40, topP: 0.95 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gemini API error ${res.status}`);
  }

  const data = await res.json() as { candidates?: Array<{ content: { parts: { text: string }[] } }> };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!raw) throw new Error("Empty response from Gemini");

  const parsed = robustParseSchedule(raw);
  if (!parsed?.days?.length) throw new Error("No days in AI response");
  return parsed.days.filter((d) => d.date >= effectiveStart && d.date <= month.end);
}

// ─── HoloLine ─────────────────────────────────────────────────────────────────

const HoloLine = memo(function HoloLine({ className }: { className?: string }) {
  return (
    <div className={cn("h-px w-full", className)}
      style={{ background: "linear-gradient(90deg, transparent, rgba(125,211,252,0.25), transparent)" }} />
  );
});

// ─── MonthNode (desktop) ──────────────────────────────────────────────────────

const MonthNode = memo(function MonthNode({
  month, progress, taskCount, isSelected, onClick,
}: {
  month: typeof TIMELINE_MONTHS[number];
  progress: number;
  taskCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const today = new Date();
  const isPast    = new Date(month.end) < today;
  const isCurrent = !isPast && new Date(month.start) <= today;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -5, scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      className="relative flex flex-col items-center gap-2.5 group focus:outline-none"
    >
      {/* Glow */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="absolute -inset-4 rounded-3xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(14,165,233,0.14) 0%, transparent 70%)" }}
          />
        )}
      </AnimatePresence>

      {/* Card */}
      <div
        className={cn(
          "relative w-[118px] rounded-2xl border transition-all duration-300 p-4 flex flex-col items-center gap-3",
          isSelected
            ? "border-[rgba(14,165,233,0.7)] bg-[rgba(14,165,233,0.1)]"
            : isCurrent
            ? "border-[rgba(14,165,233,0.3)] bg-[rgba(14,165,233,0.04)]"
            : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] group-hover:border-[rgba(255,255,255,0.16)]",
        )}
        style={isSelected ? { boxShadow: "0 0 28px rgba(14,165,233,0.2), 0 4px 20px rgba(0,0,0,0.5)" } : undefined}
      >
        {/* Month name */}
        <span className={cn(
          "text-[13px] font-bold tracking-[0.16em] uppercase",
          isSelected ? "text-[#7DD3FC]" : isCurrent ? "text-[rgba(125,211,252,0.8)]" : "text-[rgba(255,255,255,0.45)]",
        )}>
          {month.short}
        </span>
        <span className="text-[10px] text-[rgba(255,255,255,0.22)] -mt-2.5 tracking-wider">{month.year}</span>

        {/* Progress ring */}
        <div className="relative w-[52px] h-[52px]">
          <svg width="52" height="52" className="rotate-[-90deg]">
            <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <motion.circle
              cx="26" cy="26" r="20" fill="none"
              stroke={isSelected ? "#0EA5E9" : isCurrent ? "rgba(14,165,233,0.55)" : "rgba(255,255,255,0.14)"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 20}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - progress / 100) }}
              transition={{ duration: 1.1, delay: 0.15, ease: "easeOut" }}
            />
          </svg>
          <span className={cn(
            "absolute inset-0 flex items-center justify-center text-[11px] font-bold",
            isSelected ? "text-[#7DD3FC]" : "text-[rgba(255,255,255,0.5)]",
          )}>
            {progress}%
          </span>
        </div>

        {/* Task count */}
        {taskCount > 0 && (
          <span className="text-[10px] text-[rgba(255,255,255,0.28)] -mt-1">
            {taskCount} tasks
          </span>
        )}

        {/* Status dot */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            animate={isCurrent ? { opacity: [0.5, 1, 0.5] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              background: isPast ? "rgba(255,255,255,0.18)" : isCurrent ? "#0EA5E9" : "rgba(255,255,255,0.1)",
              boxShadow: isCurrent ? "0 0 7px #0EA5E9" : undefined,
            }}
          />
          <span className={cn(
            "text-[8px] uppercase tracking-wider font-medium",
            isPast ? "text-[rgba(255,255,255,0.2)]" : isCurrent ? "text-[rgba(14,165,233,0.7)]" : "text-[rgba(255,255,255,0.22)]",
          )}>
            {isPast ? "past" : isCurrent ? "now" : "ahead"}
          </span>
        </div>
      </div>

      {/* Connector dot */}
      <motion.div
        className="w-2 h-2 rounded-full border"
        animate={isSelected ? { scale: [1, 1.4, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{
          background: isSelected ? "#0EA5E9" : "rgba(255,255,255,0.1)",
          borderColor: isSelected ? "#0EA5E9" : "rgba(255,255,255,0.12)",
          boxShadow: isSelected ? "0 0 10px rgba(14,165,233,0.7)" : undefined,
        }}
      />
    </motion.button>
  );
});

// ─── MobileMonthNode ──────────────────────────────────────────────────────────

const MobileMonthNode = memo(function MobileMonthNode({
  month, progress, taskCount, isSelected, onClick,
}: {
  month: typeof TIMELINE_MONTHS[number];
  progress: number;
  taskCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const today = new Date();
  const isPast    = new Date(month.end) < today;
  const isCurrent = !isPast && new Date(month.start) <= today;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="relative w-full flex items-center gap-4 rounded-2xl border px-4 py-3.5 text-left focus:outline-none transition-all duration-300"
      style={{
        borderColor: isSelected ? "rgba(14,165,233,0.6)" : isCurrent ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.07)",
        background:  isSelected ? "rgba(14,165,233,0.08)" : "rgba(255,255,255,0.02)",
        boxShadow:   isSelected ? "0 0 20px rgba(14,165,233,0.14), 0 2px 12px rgba(0,0,0,0.35)" : undefined,
      }}
    >
      {/* Progress ring */}
      <div className="relative shrink-0 w-12 h-12">
        <svg width="48" height="48" className="rotate-[-90deg]">
          <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
          <motion.circle
            cx="24" cy="24" r="18" fill="none"
            stroke={isSelected ? "#0EA5E9" : isCurrent ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.14)"}
            strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 18}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 18 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 18 * (1 - progress / 100) }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </svg>
        <span className={cn(
          "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
          isSelected ? "text-[#7DD3FC]" : "text-[rgba(255,255,255,0.45)]",
        )}>
          {progress}%
        </span>
      </div>

      {/* Label + status */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[15px] font-bold tracking-wide",
          isSelected ? "text-[#7DD3FC]" : isCurrent ? "text-[rgba(255,255,255,0.85)]" : "text-[rgba(255,255,255,0.42)]",
        )}>
          {month.label} <span className="text-[12px] font-normal opacity-50">{month.year}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            animate={isCurrent ? { opacity: [0.5, 1, 0.5] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              background: isPast ? "rgba(255,255,255,0.2)" : isCurrent ? "#0EA5E9" : "rgba(255,255,255,0.12)",
              boxShadow:  isCurrent ? "0 0 5px #0EA5E9" : undefined,
            }}
          />
          <span className="text-[10px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider">
            {isPast ? "Past" : isCurrent ? "Current" : "Upcoming"}
          </span>
          {taskCount > 0 && (
            <span className="text-[10px] text-[rgba(255,255,255,0.22)]">· {taskCount} tasks</span>
          )}
        </div>
      </div>

      <ChevronLeft
        className={cn("h-4 w-4 shrink-0 rotate-180 transition-colors", isSelected ? "text-[#0EA5E9]" : "text-[rgba(255,255,255,0.2)]")}
      />
    </motion.button>
  );
});

// ─── DomainCard ───────────────────────────────────────────────────────────────

const DomainCard = memo(function DomainCard({
  domain, completedCount, totalCount,
}: {
  domain: typeof DOMAINS[number];
  completedCount: number;
  totalCount: number;
}) {
  const pct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className="relative rounded-2xl border p-4 overflow-hidden"
      style={{
        borderColor: `${domain.color}28`,
        background: `linear-gradient(135deg, ${domain.color}08 0%, rgba(0,0,0,0) 100%)`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 60% 50% at 0% 0%, ${domain.glow} 0%, transparent 60%)`, opacity: 0.4 }}
      />
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl leading-none">{domain.icon}</span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: domain.color }}>{domain.label}</p>
            <p className="text-[11px] text-[rgba(255,255,255,0.35)] mt-0.5">{totalCount} task{totalCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <span className="text-[13px] font-bold shrink-0" style={{ color: domain.color }}>{pct}%</span>
      </div>
      <div className="relative z-10 mt-3 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${domain.color}cc, ${domain.color})` }}
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
});

// ─── TaskRow ──────────────────────────────────────────────────────────────────

const TaskRow = memo(function TaskRow({
  task, onToggle,
}: {
  task: TimelineTask;
  onToggle: (id: string) => void;
}) {
  const d = domainConfig(task.domain);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all duration-200 cursor-pointer",
        task.completed
          ? "border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)] opacity-50"
          : "border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.12)]",
      )}
      onClick={() => onToggle(task.id)}
      style={!task.completed ? { boxShadow: `inset 0 0 20px ${d.color}08` } : undefined}
    >
      <div
        className="shrink-0 h-5 w-5 rounded-full border flex items-center justify-center transition-all duration-200"
        style={{
          borderColor: task.completed ? "rgba(255,255,255,0.15)" : `${d.color}80`,
          background: task.completed ? "rgba(255,255,255,0.05)" : `${d.color}14`,
        }}
      >
        {task.completed && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: d.color }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn("text-[13px] font-medium truncate", task.completed && "line-through")}
          style={{ color: task.completed ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)" }}
        >
          {task.title}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: d.color, opacity: task.completed ? 0.4 : 0.7 }}>
          {format12(task.startTime)} – {format12(task.endTime)}
        </p>
      </div>
      <span
        className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
        style={{ background: `${d.color}18`, color: d.color, border: `1px solid ${d.color}30` }}
      >
        {d.label}
      </span>
    </motion.div>
  );
});

// ─── DayPanel ─────────────────────────────────────────────────────────────────

const DayPanel = memo(function DayPanel({
  date, tasks, onToggle,
}: {
  date: string;
  tasks: TimelineTask[];
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const completed = tasks.filter((t) => t.completed).length;
  const pct = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);
  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: isToday ? "rgba(14,165,233,0.38)" : "rgba(255,255,255,0.07)",
        background: isToday ? "rgba(14,165,233,0.04)" : "rgba(255,255,255,0.015)",
        boxShadow: isToday ? "0 0 22px rgba(14,165,233,0.09)" : undefined,
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className={cn("text-[13px] font-semibold", isToday ? "text-[#7DD3FC]" : "text-[rgba(255,255,255,0.8)]")}>
              {formatDate(date)}
            </span>
            {isToday && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[rgba(14,165,233,0.2)] text-[#7DD3FC] border border-[rgba(14,165,233,0.3)]">
                Today
              </span>
            )}
          </div>
          <p className="text-[11px] text-[rgba(255,255,255,0.3)] mt-0.5">{tasks.length} tasks · {pct}% done</p>
        </div>
        <div className="w-20 h-1 rounded-full overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #0EA5E9, #38BDF8)" }}
          />
        </div>
        <span className="text-[11px] font-bold shrink-0 w-8 text-right" style={{ color: pct === 100 ? "#34D399" : "rgba(255,255,255,0.4)" }}>
          {pct}%
        </span>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-[rgba(255,255,255,0.25)] shrink-0" />
          : <ChevronDown className="h-4 w-4 text-[rgba(255,255,255,0.25)] shrink-0" />
        }
      </button>

      <AnimatePresence initial={false}>
        {expanded && tasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-2">
              <div className="h-px w-full mb-2" style={{ background: "rgba(125,211,252,0.07)" }} />
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={onToggle} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ─── AnalyticsPanel ───────────────────────────────────────────────────────────

const AnalyticsPanel = memo(function AnalyticsPanel({
  tasks, monthKey: _monthKey,
}: {
  tasks: TimelineTask[];
  monthKey: string;
}) {
  const completed = tasks.filter((t) => t.completed).length;
  const total     = tasks.length;
  const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);

  const domainStats = useMemo(() =>
    DOMAINS.map((d) => {
      const dt = tasks.filter((t) => t.domain === d.id);
      return { ...d, total: dt.length, completed: dt.filter((t) => t.completed).length };
    }).filter((d) => d.total > 0).sort((a, b) => b.total - a.total),
    [tasks],
  );

  const activeDays = useMemo(() => new Set(tasks.map((t) => t.date)).size, [tasks]);

  const stats = [
    { label: "Tasks Done",  value: `${completed}/${total}`, icon: CheckCircle2, color: "#34D399" },
    { label: "Active Days", value: activeDays,              icon: Calendar,     color: "#0EA5E9" },
    { label: "Completion",  value: `${pct}%`,               icon: TrendingUp,   color: "#8B5CF6" },
    { label: "Domains",     value: domainStats.length,      icon: Target,       color: "#F59E0B" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border p-4 text-center"
            style={{ borderColor: `${s.color}25`, background: `${s.color}08` }}
          >
            <s.icon className="h-4 w-4 mx-auto mb-2" style={{ color: s.color }} />
            <p className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-[rgba(255,255,255,0.4)] mt-0.5 uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider">Overall Progress</span>
          <span className="text-[13px] font-bold text-[#7DD3FC]">{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #0369A1, #0EA5E9, #38BDF8)" }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
      </div>

      {domainStats.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-[rgba(255,255,255,0.35)] uppercase tracking-wider">Domain Breakdown</p>
          {domainStats.slice(0, 6).map((d, i) => {
            const p = d.total === 0 ? 0 : Math.round((d.completed / d.total) * 100);
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3"
              >
                <span className="text-base w-6 text-center">{d.icon}</span>
                <span className="text-[12px] w-28 shrink-0" style={{ color: d.color }}>{d.label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${d.color}88, ${d.color})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p}%` }}
                    transition={{ duration: 0.8, delay: i * 0.05 + 0.2, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[11px] font-semibold w-8 text-right" style={{ color: d.color }}>{p}%</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ─── OverviewPanel (new) ──────────────────────────────────────────────────────

const OverviewPanel = memo(function OverviewPanel({ allTasks }: { allTasks: TimelineTask[] }) {
  const total     = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  const overallPct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const monthStats = useMemo(() =>
    TIMELINE_MONTHS.map((m) => {
      const mt = allTasks.filter((t) => t.monthKey === m.key);
      const mc = mt.filter((t) => t.completed).length;
      return { ...m, total: mt.length, completed: mc, pct: mt.length === 0 ? 0 : Math.round((mc / mt.length) * 100) };
    }), [allTasks]);

  const domainStats = useMemo(() =>
    DOMAINS.map((d) => {
      const dt = allTasks.filter((t) => t.domain === d.id);
      const dc = dt.filter((t) => t.completed).length;
      return { ...d, total: dt.length, completed: dc, pct: dt.length === 0 ? 0 : Math.round((dc / dt.length) * 100) };
    }).filter((d) => d.total > 0).sort((a, b) => b.total - a.total),
    [allTasks],
  );

  if (total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-12 text-center mt-4"
        style={{ borderColor: "rgba(125,211,252,0.1)", background: "rgba(125,211,252,0.02)" }}
      >
        <BarChart3 className="h-10 w-10 mx-auto mb-4 text-[rgba(125,211,252,0.2)]" />
        <p className="text-[16px] font-medium text-[rgba(255,255,255,0.5)]">No timeline data yet</p>
        <p className="text-[13px] text-[rgba(255,255,255,0.25)] mt-1.5 max-w-xs mx-auto">
          Select a month, write your goals, and generate a schedule to see your overall progress here.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-8 mt-4"
    >
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Tasks",   value: total,          color: "#0EA5E9", icon: Target      },
          { label: "Completed",     value: completed,      color: "#34D399", icon: CheckCircle2 },
          { label: "Active Months", value: monthStats.filter((m) => m.total > 0).length, color: "#8B5CF6", icon: Calendar },
          { label: "Overall Rate",  value: `${overallPct}%`, color: "#F59E0B", icon: TrendingUp },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border p-4 text-center"
            style={{ borderColor: `${s.color}25`, background: `${s.color}08` }}
          >
            <s.icon className="h-4 w-4 mx-auto mb-2" style={{ color: s.color }} />
            <p className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-[rgba(255,255,255,0.4)] mt-0.5 uppercase tracking-wider">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Master progress bar */}
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: "rgba(125,211,252,0.1)", background: "rgba(125,211,252,0.03)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider">
            Overall Progress — May → Oct 2026
          </span>
          <span className="text-[18px] font-bold text-[#7DD3FC]">{overallPct}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #0369A1, #0EA5E9, #38BDF8)" }}
            initial={{ width: 0 }}
            animate={{ width: `${overallPct}%` }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </div>
        <p className="text-[11px] text-[rgba(255,255,255,0.3)] mt-2">
          {completed} of {total} tasks completed across all months
        </p>
      </div>

      {/* Per-month comparison */}
      <div className="space-y-4">
        <p className="text-[11px] text-[rgba(255,255,255,0.35)] uppercase tracking-wider">Month-by-Month Breakdown</p>
        <div className="space-y-3">
          {monthStats.map((m, i) => (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border p-4"
              style={{
                borderColor: m.total > 0 ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.05)",
                background: m.total > 0 ? "rgba(14,165,233,0.03)" : "rgba(255,255,255,0.01)",
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 shrink-0">
                  <p className="text-[14px] font-bold text-[rgba(255,255,255,0.7)]">{m.short}</p>
                  <p className="text-[10px] text-[rgba(255,255,255,0.3)]">{m.year}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: m.total > 0 ? "linear-gradient(90deg, #0369A1, #0EA5E9)" : "rgba(255,255,255,0.08)" }}
                        initial={{ width: 0 }}
                        animate={{ width: m.total > 0 ? `${m.pct}%` : "0%" }}
                        transition={{ duration: 0.8, delay: i * 0.08 + 0.2, ease: "easeOut" }}
                      />
                    </div>
                    <span
                      className="text-[13px] font-bold w-10 text-right"
                      style={{ color: m.total > 0 ? "#7DD3FC" : "rgba(255,255,255,0.2)" }}
                    >
                      {m.pct}%
                    </span>
                  </div>
                  <p className="text-[10px] text-[rgba(255,255,255,0.3)]">
                    {m.total === 0 ? "No schedule generated" : `${m.completed}/${m.total} tasks · ${m.total} scheduled`}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Domain breakdown */}
      {domainStats.length > 0 && (
        <div className="space-y-4">
          <p className="text-[11px] text-[rgba(255,255,255,0.35)] uppercase tracking-wider">Domain Breakdown — All Months</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {domainStats.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border p-4"
                style={{ borderColor: `${d.color}22`, background: `${d.color}06` }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{d.icon}</span>
                    <span className="text-[13px] font-semibold" style={{ color: d.color }}>{d.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[15px] font-bold" style={{ color: d.color }}>{d.pct}%</span>
                    <p className="text-[10px] text-[rgba(255,255,255,0.3)]">{d.completed}/{d.total}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${d.color}88, ${d.color})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.pct}%` }}
                    transition={{ duration: 0.7, delay: i * 0.05 + 0.3, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});

// ─── Main page ────────────────────────────────────────────────────────────────

function TimelinePage() {
  const {
    tasks: allTasks,
    loaded,
    saveContext,
    saveGeneratedSchedule,
    toggleTask,
    getMonthData,
    getMonthTasks,
    getMonthProgress,
  } = useTimeline();

  const [mainView, setMainView]                 = useState<"timeline" | "overview">("timeline");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [generating, setGenerating]             = useState(false);
  const [activeTab, setActiveTab]               = useState<"context" | "schedule" | "analytics">("context");
  const [clearingTasks, setClearingTasks]       = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [localContext, setLocalContext]       = useState("");
  const [contextSaving, setContextSaving]     = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedMonth = TIMELINE_MONTHS.find((m) => m.key === selectedMonthKey) ?? null;
  const monthData     = selectedMonthKey ? getMonthData(selectedMonthKey) : null;
  const monthTasks    = selectedMonthKey ? getMonthTasks(selectedMonthKey) : [];

  // Sync context from DB when month changes
  useEffect(() => {
    if (!loaded) return;
    setLocalContext(monthData?.context ?? "");
    setShowClearConfirm(false);
  }, [selectedMonthKey, loaded, monthData?.context]);

  // Debounced autosave
  const handleContextChange = useCallback((val: string) => {
    setLocalContext(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!selectedMonthKey) return;
      setContextSaving(true);
      try { await saveContext(selectedMonthKey, val); }
      catch { /* silent */ }
      finally { setContextSaving(false); }
    }, 1500);
  }, [selectedMonthKey, saveContext]);

  const handleGenerate = useCallback(async () => {
    if (!selectedMonthKey || !localContext.trim()) {
      toast.error("Please write your end goal context first");
      return;
    }
    setGenerating(true);
    try {
      const days = await generateScheduleWithGemini(localContext, selectedMonthKey);

      const horizonInputs: HorizonTaskInput[] = days.flatMap((day) =>
        day.tasks.map((t) => {
          const domId = (DOMAINS.find((d) => d.id === t.domain)?.id ?? "development") as DomainId;
          return {
            title: t.title,
            description: encodeTimelineDesc(selectedMonthKey, domId),
            taskDate: day.date,
            taskTime: t.startTime,
            priority: "medium" as const,
            notificationEnabled: true,
          };
        })
      );

      saveGeneratedSchedule(selectedMonthKey, JSON.stringify(days, null, 2));
      const horizonCount = await addTasksBatch(horizonInputs);

      toast.success(
        `${horizonCount} tasks generated across ${days.length} days — now visible in Horizon`,
        { duration: 4000 },
      );
      setActiveTab("schedule");
    } catch (err) {
      console.error("[timeline] generation error", err);
      toast.error(
        err instanceof Error ? err.message : "Generation failed. Check your context and try again.",
        { duration: 5000 },
      );
    } finally {
      setGenerating(false);
    }
  }, [selectedMonthKey, localContext, saveGeneratedSchedule]);

  const handleClearMonth = useCallback(async () => {
    if (!selectedMonthKey) return;
    setShowClearConfirm(false);
    setClearingTasks(true);
    try {
      const deleted = await deleteTasksByMonthKey(selectedMonthKey);
      await saveGeneratedSchedule(selectedMonthKey, "");
      if (deleted > 0) {
        toast.success(`${deleted} timeline tasks cleared from Horizon`, { duration: 3000 });
      } else {
        toast.info("No timeline tasks found for this month", { duration: 2000 });
      }
    } catch {
      toast.error("Failed to clear tasks");
    } finally {
      setClearingTasks(false);
    }
  }, [selectedMonthKey, saveGeneratedSchedule]);

  // Group tasks by date for schedule view
  const tasksByDate = useMemo(() => {
    const map: Record<string, TimelineTask[]> = {};
    monthTasks.forEach((t) => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return map;
  }, [monthTasks]);

  const scheduleDates = useMemo(() => {
    if (!selectedMonth) return [];
    return getDaysInRange(selectedMonth.start, selectedMonth.end)
      .filter((d) => tasksByDate[d]?.length);
  }, [selectedMonth, tasksByDate]);

  const domainStats = useMemo(() =>
    DOMAINS.map((d) => {
      const dt = monthTasks.filter((t) => t.domain === d.id);
      return { ...d, total: dt.length, completed: dt.filter((t) => t.completed).length };
    }),
    [monthTasks],
  );

  const TABS = [
    { id: "context"   as const, label: "End Goal Context" },
    { id: "schedule"  as const, label: "Schedule" },
    { id: "analytics" as const, label: "Analytics" },
  ];

  return (
    <div className="relative min-h-full px-4 md:px-8 lg:px-12 py-8 md:py-12 max-w-6xl mx-auto">

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute top-[-20%] left-[-10%] w-[70%] h-[60%] rounded-full opacity-[0.035]"
          style={{ background: "radial-gradient(ellipse, #0EA5E9 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full opacity-[0.025]"
          style={{ background: "radial-gradient(ellipse, #8B5CF6 0%, transparent 70%)", filter: "blur(80px)" }}
        />
      </div>

      {/* ── Header ── */}
      {!selectedMonthKey ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="h-8 w-8 rounded-xl grid place-items-center"
                  style={{ background: "linear-gradient(135deg, rgba(14,165,233,0.3), rgba(56,189,248,0.15))", border: "1px solid rgba(14,165,233,0.3)", boxShadow: "0 0 16px rgba(14,165,233,0.2)" }}
                >
                  <Zap className="h-4 w-4 text-[#38BDF8]" />
                </div>
                <h1
                  className="text-[32px] md:text-[42px] font-bold tracking-[-0.02em] leading-none"
                  style={{ background: "linear-gradient(135deg, #FFFFFF 30%, rgba(125,211,252,0.8) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                >
                  TIMELINE
                </h1>
              </div>
              <p className="text-[14px] text-[rgba(255,255,255,0.35)] tracking-wide ml-11">
                Structured evolution across domains.
              </p>
            </div>

            {/* View toggle */}
            <div
              className="flex gap-1 rounded-xl p-1"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {([
                { id: "timeline" as const, label: "Months",   icon: Calendar   },
                { id: "overview" as const, label: "Overview", icon: BarChart3  },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMainView(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold tracking-wide transition-all duration-200",
                    mainView === id ? "text-[#7DD3FC]" : "text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.6)]",
                  )}
                  style={mainView === id ? { background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)" } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 ml-11">
            <HoloLine className="max-w-xs" />
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6 flex items-center gap-3"
        >
          <button
            onClick={() => setSelectedMonthKey(null)}
            className="flex items-center gap-1.5 text-[13px] text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.8)] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Timeline
          </button>
          <span className="text-[rgba(255,255,255,0.15)]">/</span>
          <span className="text-[13px] font-semibold text-[#7DD3FC]">{selectedMonth?.label}</span>
        </motion.div>
      )}

      {/* ── Main views (no month selected) ── */}
      <AnimatePresence mode="wait">
        {!selectedMonthKey && (
          <motion.div
            key="main-views"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimatePresence mode="wait">

              {/* ── Timeline month rail ── */}
              {mainView === "timeline" && (
                <motion.div
                  key="timeline-rail"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="relative mb-10">
                    {/* Desktop connector line */}
                    <div
                      className="hidden md:flex absolute left-0 right-0 items-center pointer-events-none"
                      style={{ top: "calc(50% - 28px)" }}
                    >
                      <div
                        className="flex-1 h-px"
                        style={{ background: "linear-gradient(90deg, transparent 3%, rgba(125,211,252,0.2) 18%, rgba(125,211,252,0.2) 82%, transparent 97%)" }}
                      />
                    </div>

                    {/* Mobile vertical connector */}
                    <div
                      className="md:hidden absolute top-0 bottom-0 w-px pointer-events-none"
                      style={{ left: "48px", background: "linear-gradient(180deg, transparent 2%, rgba(125,211,252,0.18) 15%, rgba(125,211,252,0.18) 85%, transparent 98%)" }}
                    />

                    {/* Month nodes */}
                    <div className="relative flex md:flex-row flex-col md:items-start items-stretch md:justify-between md:gap-2 gap-4 md:overflow-x-auto md:pb-2 scroll-hide">
                      {TIMELINE_MONTHS.map((month) => (
                        <div key={month.key} className="md:contents flex items-center gap-4">
                          <div className="md:hidden">
                            <MobileMonthNode
                              month={month}
                              progress={getMonthProgress(month.key)}
                              taskCount={getMonthTasks(month.key).length}
                              isSelected={selectedMonthKey === month.key}
                              onClick={() => setSelectedMonthKey(month.key)}
                            />
                          </div>
                          <div className="hidden md:block">
                            <MonthNode
                              month={month}
                              progress={getMonthProgress(month.key)}
                              taskCount={getMonthTasks(month.key).length}
                              isSelected={selectedMonthKey === month.key}
                              onClick={() => setSelectedMonthKey(month.key)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instruction card */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl border p-6 text-center"
                    style={{ borderColor: "rgba(125,211,252,0.12)", background: "rgba(125,211,252,0.03)" }}
                  >
                    <Calendar className="h-8 w-8 mx-auto mb-3 text-[rgba(125,211,252,0.4)]" />
                    <p className="text-[15px] font-semibold text-[rgba(255,255,255,0.65)]">Select a month to begin planning</p>
                    <p className="text-[13px] text-[rgba(255,255,255,0.25)] mt-1.5">
                      Set your end goals, generate AI-powered schedules, and track domain progress.
                    </p>
                  </motion.div>

                  {/* Global domain overview */}
                  {loaded && domainStats.some((s) => s.total > 0) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-8"
                    >
                      <p className="text-[11px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-4">All Domains</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {domainStats.filter((d) => d.total > 0).map((d) => (
                          <DomainCard key={d.id} domain={d} completedCount={d.completed} totalCount={d.total} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ── Overview panel ── */}
              {mainView === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <OverviewPanel allTasks={allTasks} />
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Month detail panel ── */}
        {selectedMonthKey && selectedMonth && (
          <motion.div
            key={`detail-${selectedMonthKey}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* Month header card */}
            <div
              className="relative rounded-2xl border p-5 overflow-hidden"
              style={{ borderColor: "rgba(14,165,233,0.3)", background: "rgba(14,165,233,0.05)", boxShadow: "0 0 30px rgba(14,165,233,0.08)" }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse 70% 80% at 0% 0%, rgba(14,165,233,0.1) 0%, transparent 60%)" }}
              />
              <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2
                      className="text-[28px] md:text-[36px] font-bold tracking-[-0.02em] leading-none"
                      style={{ background: "linear-gradient(135deg, #FFFFFF 30%, #7DD3FC 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                    >
                      {selectedMonth.label.toUpperCase()}
                    </h2>
                    <span className="text-[13px] font-semibold text-[rgba(125,211,252,0.6)] bg-[rgba(14,165,233,0.12)] border border-[rgba(14,165,233,0.2)] px-2.5 py-1 rounded-full">
                      {selectedMonth.year}
                    </span>
                  </div>
                  <p className="text-[13px] text-[rgba(255,255,255,0.4)]">
                    {new Date(selectedMonth.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" → "}
                    {new Date(selectedMonth.end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>

                {/* Progress ring */}
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14">
                    <svg width="56" height="56" className="rotate-[-90deg]">
                      <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                      <motion.circle
                        cx="28" cy="28" r="22" fill="none"
                        stroke="#0EA5E9" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 22}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - getMonthProgress(selectedMonthKey) / 100) }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#7DD3FC]">
                      {getMonthProgress(selectedMonthKey)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider">Progress</p>
                    <p className="text-[13px] font-semibold text-[rgba(255,255,255,0.7)]">
                      {monthTasks.filter((t) => t.completed).length}/{monthTasks.length} tasks
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div
              className="flex gap-1 rounded-xl p-1"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[12px] font-semibold tracking-wide transition-all duration-200",
                    activeTab === tab.id
                      ? "text-[#7DD3FC]"
                      : "text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.6)]",
                  )}
                  style={activeTab === tab.id ? { background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)" } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">

              {/* ── Context tab ── */}
              {activeTab === "context" && (
                <motion.div
                  key="context"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-[14px] font-bold text-[rgba(255,255,255,0.85)] uppercase tracking-wider">End Goal Context</h3>
                        <p className="text-[12px] text-[rgba(255,255,255,0.3)] mt-0.5">
                          Write your monthly goals, routines, and priorities. This powers the AI schedule.
                        </p>
                      </div>
                      {contextSaving && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[rgba(125,211,252,0.5)]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Saving…
                        </div>
                      )}
                      {!contextSaving && monthData?.context && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[rgba(52,211,153,0.6)]">
                          <Save className="h-3 w-3" />
                          Saved
                        </div>
                      )}
                    </div>

                    <textarea
                      value={localContext}
                      onChange={(e) => handleContextChange(e.target.value)}
                      placeholder={`Describe your ${selectedMonth.label} goals, daily routines, and priorities...\n\nExamples:\n• Wake up 6 AM, gym 6:15–8:00\n• Dev work 10 AM–5 PM\n• Cricket practice 2 hours daily\n• Monthly goal: finish React course, build 2 projects`}
                      className="w-full min-h-[240px] md:min-h-[300px] rounded-2xl px-5 py-4 text-[13px] leading-relaxed resize-none focus:outline-none transition-all duration-200"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(125,211,252,0.15)",
                        color: "rgba(255,255,255,0.8)",
                        caretColor: "#7DD3FC",
                        boxShadow: "inset 0 0 20px rgba(0,0,0,0.15)",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)";
                        e.currentTarget.style.boxShadow = "inset 0 0 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(14,165,233,0.15)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(125,211,252,0.15)";
                        e.currentTarget.style.boxShadow = "inset 0 0 20px rgba(0,0,0,0.15)";
                      }}
                    />
                  </div>

                  {/* Domain chips */}
                  <div>
                    <p className="text-[11px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-3">Tracked Domains</p>
                    <div className="flex flex-wrap gap-2">
                      {DOMAINS.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
                          style={{ background: `${d.color}12`, border: `1px solid ${d.color}28`, color: d.color }}
                        >
                          <span>{d.icon}</span>
                          {d.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <HoloLine />

                  {/* Generate button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <motion.button
                      onClick={handleGenerate}
                      disabled={generating || !localContext.trim()}
                      whileHover={!generating && localContext.trim() ? { scale: 1.02, y: -1 } : {}}
                      whileTap={!generating && localContext.trim() ? { scale: 0.98 } : {}}
                      className={cn(
                        "relative flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[14px] font-bold tracking-wide overflow-hidden transition-all duration-300",
                        generating || !localContext.trim() ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                      )}
                      style={{
                        background: generating || !localContext.trim()
                          ? "rgba(255,255,255,0.05)"
                          : "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(56,189,248,0.15))",
                        border: generating || !localContext.trim()
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid rgba(14,165,233,0.5)",
                        boxShadow: generating || !localContext.trim()
                          ? "none"
                          : "0 0 24px rgba(14,165,233,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.9)",
                      }}
                    >
                      {!generating && localContext.trim() && (
                        <motion.div
                          className="absolute inset-0 pointer-events-none"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
                          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", width: "60%" }}
                        />
                      )}
                      {generating
                        ? <Loader2 className="h-4 w-4 animate-spin text-[#7DD3FC]" />
                        : <Sparkles className="h-4 w-4 text-[#7DD3FC]" />
                      }
                      <span>{generating ? "Generating schedule…" : "Schedule Month"}</span>
                    </motion.button>

                    {generating && (
                      <p className="text-[12px] text-[rgba(125,211,252,0.5)] animate-pulse">
                        AI is analyzing your context and generating daily tasks…
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── Schedule tab ── */}
              {activeTab === "schedule" && (
                <motion.div
                  key="schedule"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Domain overview cards */}
                  {domainStats.filter((d) => d.total > 0).length > 0 && (
                    <div>
                      <p className="text-[11px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider mb-3">Domain Overview</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                        {domainStats.filter((d) => d.total > 0).map((d) => (
                          <DomainCard key={d.id} domain={d} completedCount={d.completed} totalCount={d.total} />
                        ))}
                      </div>
                      <HoloLine className="mb-5" />
                    </div>
                  )}

                  {/* Day panels */}
                  {scheduleDates.length === 0 ? (
                    <div
                      className="rounded-2xl border p-8 text-center"
                      style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
                    >
                      <Clock className="h-8 w-8 mx-auto mb-3 text-[rgba(255,255,255,0.2)]" />
                      <p className="text-[14px] font-medium text-[rgba(255,255,255,0.4)]">No schedule generated yet</p>
                      <p className="text-[12px] text-[rgba(255,255,255,0.25)] mt-1.5 mb-5">
                        Write your end goal context and click "Schedule Month" to generate an AI-powered schedule.
                      </p>
                      <button
                        onClick={() => setActiveTab("context")}
                        className="text-[13px] font-semibold text-[#7DD3FC] hover:text-white transition-colors"
                      >
                        Go to Context →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Stats row + controls */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-[11px] text-[rgba(255,255,255,0.3)] uppercase tracking-wider">
                          {scheduleDates.length} days · {monthTasks.length} tasks
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveTab("context")}
                            className="flex items-center gap-1.5 text-[11px] text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)] transition-colors px-2.5 py-1.5 rounded-lg border border-transparent hover:border-[rgba(255,255,255,0.08)]"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Regenerate
                          </button>

                          {/* Clear month button */}
                          <AnimatePresence mode="wait">
                            {!showClearConfirm ? (
                              <motion.button
                                key="clear-btn"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowClearConfirm(true)}
                                disabled={clearingTasks}
                                className="flex items-center gap-1.5 text-[11px] text-[rgba(239,68,68,0.55)] hover:text-[rgba(239,68,68,0.85)] transition-colors px-2.5 py-1.5 rounded-lg border border-transparent hover:border-[rgba(239,68,68,0.18)] hover:bg-[rgba(239,68,68,0.05)]"
                              >
                                {clearingTasks
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Trash2 className="h-3 w-3" />
                                }
                                {clearingTasks ? "Clearing…" : "Clear Month"}
                              </motion.button>
                            ) : (
                              <motion.div
                                key="clear-confirm"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5"
                                style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.07)" }}
                              >
                                <span className="text-[11px] text-[rgba(255,255,255,0.6)]">Delete all timeline tasks?</span>
                                <button
                                  onClick={handleClearMonth}
                                  className="text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors px-1.5"
                                >
                                  Yes, clear
                                </button>
                                <button
                                  onClick={() => setShowClearConfirm(false)}
                                  className="text-[11px] text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.6)] transition-colors px-1"
                                >
                                  Cancel
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {scheduleDates.map((date) => (
                        <DayPanel
                          key={date}
                          date={date}
                          tasks={tasksByDate[date] ?? []}
                          onToggle={toggleTask}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Analytics tab ── */}
              {activeTab === "analytics" && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <AnalyticsPanel tasks={monthTasks} monthKey={selectedMonthKey} />
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
