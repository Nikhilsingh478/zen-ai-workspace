import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  ArrowLeft,
  Check,
  Trash2,
  Pencil,
  Bell,
  BellOff,
  Clock,
  BellRing,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useHorizon,
  formatDateKey,
  formatDisplayDate,
  format12Hour,
  PRIORITY_CONFIG,
  type HorizonTask,
  type HorizonTaskInput,
  type Priority,
} from "@/lib/horizon";
import {
  useFCMStatus,
  requestNotificationPermission,
  getNotificationStatus,
  sendTestNotification,
} from "@/lib/fcm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/horizon")({
  head: () => ({
    meta: [
      { title: "Horizon — AI Metrics" },
      { name: "description", content: "Premium calendar and task management." },
    ],
  }),
  component: HorizonPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const ALL_MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Left-edge priority accent stripe colors
const PRIORITY_STRIPE: Record<Priority, string> = {
  low:    "bg-blue-400/[0.45]",
  medium: "bg-amber-400/[0.45]",
  high:   "bg-red-400/[0.5]",
};

// ─── Task form schema ─────────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  taskTimeHour: z.string().min(1),
  taskTimeMinute: z.string().min(1),
  taskTimeAmpm: z.enum(["AM", "PM"]),
  priority: z.enum(["low", "medium", "high"]),
  notificationEnabled: z.boolean(),
});
type TaskFormValues = z.infer<typeof taskSchema>;

// ─── Motion variants ──────────────────────────────────────────────────────────

const monthVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.26, ease: EASE } },
  exit: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? -20 : 20, transition: { duration: 0.18 } }),
};

const gridVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
  exit: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? -28 : 28, transition: { duration: 0.18 } }),
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

// ─── Group tasks by hour ──────────────────────────────────────────────────────

function groupByHour(tasks: HorizonTask[]): { label: string; tasks: HorizonTask[]; hour: number }[] {
  const map = new Map<string, { tasks: HorizonTask[]; hour: number }>();
  const sorted = [...tasks].sort((a, b) => a.taskTime.localeCompare(b.taskTime));
  for (const task of sorted) {
    const [h] = task.taskTime.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const label = `${h12} ${ampm}`;
    if (!map.has(label)) map.set(label, { tasks: [], hour });
    map.get(label)!.tasks.push(task);
  }
  return Array.from(map.entries()).map(([label, v]) => ({ label, tasks: v.tasks, hour: v.hour }));
}

// ─── Main page ────────────────────────────────────────────────────────────────

function HorizonPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<HorizonTask | null>(null);
  const [testingNotif, setTestingNotif] = useState(false);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(false);

  const { tasks, tasksForDate, datesWithTasks, add, update, toggle, remove } = useHorizon();
  const notifStatus = useFCMStatus();

  const tasksWithReminders = tasks.filter((t) => t.notificationEnabled && !t.completed).length;

  const selectedTasks = selectedDate ? tasksForDate(selectedDate) : [];
  const timelineGroups = groupByHour(selectedTasks);
  const remaining = selectedTasks.filter((t) => !t.completed).length;

  const prevMonth = useCallback(() => {
    setDirection(-1);
    setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; });
  }, []);

  const nextMonth = useCallback(() => {
    setDirection(1);
    setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; });
  }, []);

  const goToday = useCallback(() => {
    setDirection(0);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(formatDateKey(today));
  }, [today]);

  const handleDeleteAllForDate = useCallback(async () => {
    if (!selectedDate) return;
    const snapshot = [...selectedTasks];
    setConfirmDeleteDay(false);
    try {
      await Promise.all(snapshot.map((t) => remove(t.id)));
      toast.success(`${snapshot.length} task${snapshot.length === 1 ? "" : "s"} cleared`, { duration: 2000 });
    } catch {
      toast.error("Failed to clear tasks");
    }
  }, [selectedDate, selectedTasks, remove]);

  const todayKey = formatDateKey(today);

  // Calendar cells
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { dateStr: string; currentMonth: boolean; day: number }[] = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, currentMonth: false, day: d });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, currentMonth: true, day: d });
  }
  for (let d = 1; d <= 42 - cells.length; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, currentMonth: false, day: d });
  }

  const monthKey = `${viewYear}-${viewMonth}`;

  return (
    <div className="h-full flex flex-col overflow-hidden relative">

      {/* ── Ambient environmental depth ─────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgba(125,211,252,0.03),transparent)] z-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background/60 to-transparent z-0" />

      {/* ── Calendar view ─────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden px-4 md:px-8 pt-5 md:pt-3 pb-6 md:pb-2 relative z-10 md:flex md:flex-col md:items-center md:justify-center">
        <div className="w-full max-w-4xl mx-auto flex flex-col md:h-full md:max-h-[600px] 2xl:max-h-[750px]">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="flex items-center gap-3 mb-4 md:mb-2.5 flex-wrap shrink-0"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
            className="relative h-8 w-8 rounded-xl border grid place-items-center shrink-0" style={{ background: "rgba(125,211,252,0.05)", borderColor: "rgba(125,211,252,0.12)" }}
          >
            <motion.div
              className="absolute inset-0 rounded-xl"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06), transparent 70%)" }}
            />
            <CalendarDays className="h-[15px] w-[15px] relative z-10" strokeWidth={1.75} style={{ color: "rgba(125,211,252,0.75)" }} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}
          >
            <h1 className="text-[16px] font-semibold tracking-tight leading-none text-white/90">Horizon</h1>
            <p className="text-[10px] mt-0.5 tracking-[0.18em] uppercase" style={{ color: "rgba(125,211,252,0.55)" }}>Calendar & tasks</p>
          </motion.div>

          {/* Notification status pill */}
          <AnimatePresence>
            {tasksWithReminders > 0 && notifStatus === "denied" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-[10px] text-white/55"
                title="Notifications blocked — enable in browser settings"
              >
                <BellOff className="h-2.5 w-2.5" />
                Blocked
              </motion.span>
            )}
            {tasksWithReminders > 0 && notifStatus === "granted" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[10px] text-white/55"
              >
                <BellRing className="h-2.5 w-2.5" />
                {tasksWithReminders} reminder{tasksWithReminders > 1 ? "s" : ""}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Test notification button */}
          <AnimatePresence>
            {notifStatus === "granted" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.2, ease: EASE }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                disabled={testingNotif}
                onClick={async () => {
                  setTestingNotif(true);
                  try {
                    await sendTestNotification();
                    toast.success("Test notification sent — check your OS notification tray");
                  } catch (err) {
                    toast.error("Notification failed: " + (err instanceof Error ? err.message : String(err)));
                  } finally {
                    setTestingNotif(false);
                  }
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-[10px] text-white/55 hover:text-white/80 hover:border-white/[0.16] transition-all duration-200 disabled:opacity-40"
                title="Send a test notification"
              >
                <Bell className="h-2.5 w-2.5" />
                {testingNotif ? "Sending…" : "Test"}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Month navigation */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE, delay: 0.06 }}
          className="flex items-center justify-between mb-3 md:mb-2 shrink-0"
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={monthKey}
              custom={direction}
              variants={monthVariants}
              initial="enter" animate="center" exit="exit"
              className="flex items-baseline gap-2"
            >
              <h2 className="text-[18px] md:text-[19px] font-bold tracking-tight text-white/88">
                {MONTHS[viewMonth]}
              </h2>
              <span className="text-[12px] md:text-[13px] font-light text-white/48 tabular-nums">
                {viewYear}
              </span>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-1.5">
            <motion.button
              onClick={goToday}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="hidden sm:flex items-center px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/60 border hover:text-white/85 transition-all duration-200" style={{ borderColor: "rgba(125,211,252,0.12)" }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor="rgba(125,211,252,0.28)"} onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor="rgba(125,211,252,0.12)"}
            >
              Today
            </motion.button>
            {[
              { action: prevMonth, Icon: ChevronLeft, label: "Previous" },
              { action: nextMonth, Icon: ChevronRight, label: "Next" },
            ].map(({ action, Icon, label }) => (
              <motion.button
                key={label}
                onClick={action}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="h-8 w-8 rounded-lg border grid place-items-center text-white/55 hover:text-white/85 transition-all duration-200" style={{ borderColor: "rgba(125,211,252,0.12)" }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor="rgba(125,211,252,0.28)"} onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor="rgba(125,211,252,0.12)"}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Day-of-week headers */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-7 mb-1 shrink-0"
        >
          {DAYS.map((d) => (
            <motion.div
              key={d}
              variants={staggerItem}
              className="text-[9px] font-medium text-white/[0.42] text-center pb-2 tracking-[0.1em] uppercase"
            >
              {d}
            </motion.div>
          ))}
        </motion.div>

        {/* Calendar grid */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={monthKey}
            custom={direction}
            variants={gridVariants}
            initial="enter" animate="center" exit="exit"
            className="grid grid-cols-7 gap-1 md:flex-1 md:grid-rows-6"
          >
            {cells.map(({ dateStr, currentMonth, day }, cellIndex) => {
              const isToday = dateStr === todayKey;
              const isSelected = dateStr === selectedDate;
              const hasTasks = datesWithTasks.has(dateStr);
              const taskCount = hasTasks ? tasksForDate(dateStr).length : 0;

              return (
                <motion.button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: currentMonth ? 1 : 0.22, scale: 1 }}
                  transition={{ duration: 0.22, delay: cellIndex * 0.006, ease: EASE }}
                  whileHover={{ scale: 1.06, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  className="relative aspect-square md:aspect-auto md:h-full flex flex-col items-center justify-center rounded-xl text-sm transition-all duration-200"
                  style={
                    isToday
                      ? { background: "rgba(125,211,252,0.1)", border: "1px solid rgba(125,211,252,0.28)", fontWeight: 600, color: "rgba(255,255,255,0.92)", boxShadow: "0 0 0 1px rgba(125,211,252,0.06),0 4px 16px rgba(0,0,0,0.3)" }
                      : isSelected
                        ? { background: "rgba(125,211,252,0.07)", border: "1px solid rgba(125,211,252,0.16)", color: "rgba(255,255,255,0.82)" }
                        : { border: "1px solid transparent", color: "rgba(255,255,255,0.62)" }
                  }
                >
                  {/* Today ambient glow */}
                  {isToday && (
                    <motion.span
                      className="absolute inset-0 rounded-xl"
                      animate={{ boxShadow: ["0 0 0px rgba(125,211,252,0)", "0 0 18px rgba(125,211,252,0.18)", "0 0 0px rgba(125,211,252,0)"] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <span className="text-[11px] md:text-[12px] relative z-10 tabular-nums">{day}</span>
                  {hasTasks && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className={cn(
                        "mt-[3px] h-[3px] w-[3px] rounded-full relative z-10",
                        isToday || isSelected ? "bg-sky-300/60" : "bg-sky-400/[0.28]",
                      )}
                    />
                  )}
                  {taskCount > 1 && (
                    <span className={cn(
                      "absolute top-0.5 right-1 text-[8px] font-medium tabular-nums",
                      isToday || isSelected ? "text-sky-300/70" : "text-sky-400/[0.38]",
                    )}>
                      {taskCount}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>

      {/* ── Fullscreen task experience ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inset-0 z-30 bg-background flex flex-col"
          >
            {/* Ambient depth */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(125,211,252,0.025),transparent)] pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/70 to-transparent pointer-events-none" />

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.06, ease: EASE }}
              className="relative z-10 shrink-0 flex items-center justify-between px-5 md:px-10 pt-5 md:pt-7 pb-4 border-b" style={{ borderColor: "rgba(125,211,252,0.07)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  onClick={() => setSelectedDate(null)}
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="flex items-center gap-1.5 text-white/55 hover:text-white/85 transition-colors duration-150 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-[12px] font-medium hidden sm:block tracking-wide">Calendar</span>
                </motion.button>

                <div className="h-3 w-px shrink-0 hidden sm:block" style={{ background: "rgba(125,211,252,0.1)" }} />

                <div className="min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={selectedDate}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      className="text-[14px] md:text-[15px] font-semibold tracking-tight truncate text-white/85"
                    >
                      {formatDisplayDate(selectedDate)}
                    </motion.h2>
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`${selectedDate}-${remaining}-${selectedTasks.length}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="text-[10px] text-white/50 mt-0.5 tracking-wide"
                    >
                      {selectedTasks.length === 0
                        ? "Nothing scheduled"
                        : remaining === 0
                          ? "All complete"
                          : `${remaining} of ${selectedTasks.length} remaining`}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Delete-all confirmation / button */}
                <AnimatePresence mode="wait">
                  {selectedTasks.length > 0 && !confirmDeleteDay && (
                    <motion.button
                      key="delete-day-btn"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      onClick={() => setConfirmDeleteDay(true)}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-transparent hover:border-red-400/25 hover:bg-red-400/[0.08] text-[12px] text-red-400/65 hover:text-red-400/90 transition-all duration-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Clear day</span>
                    </motion.button>
                  )}
                  {confirmDeleteDay && (
                    <motion.div
                      key="delete-day-confirm"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/[0.06] px-3 py-1.5"
                    >
                      <span className="text-[11px] text-white/70 hidden xs:inline">Delete {selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"}?</span>
                      <button
                        onClick={handleDeleteAllForDate}
                        className="text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteDay(false)}
                        className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
                      >
                        No
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  onClick={() => { setEditingTask(null); setModalOpen(true); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
                  style={{ background: "rgba(125,211,252,0.08)", border: "1px solid rgba(125,211,252,0.18)", color: "rgba(125,211,252,0.85)" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Task</span>
                </motion.button>
              </div>
            </motion.div>

            {/* Timeline scroll area */}
            <div className="flex-1 min-h-0 overflow-y-auto relative z-10">
              <div className="max-w-2xl mx-auto px-4 md:px-8 py-7 md:py-10">
                <AnimatePresence mode="popLayout" initial={false}>
                  {selectedTasks.length === 0 ? (
                    <EmptyDay key="empty" />
                  ) : (
                    <Timeline
                      key={selectedDate}
                      groups={timelineGroups}
                      onToggle={(id) => toggle(id)}
                      onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
                      onDelete={(id) => remove(id)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task modal */}
      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        defaultDate={selectedDate ?? todayKey}
        editingTask={editingTask}
        onSubmit={async (input) => {
          if (editingTask) {
            const ok = await update(editingTask.id, input);
            if (ok) { setModalOpen(false); setEditingTask(null); }
          } else {
            const ok = await add(input);
            if (ok) setModalOpen(false);
          }
        }}
      />
    </div>
  );
}

// ─── Empty day ────────────────────────────────────────────────────────────────

function EmptyDay() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.38, ease: EASE }}
      className="relative flex flex-col items-center justify-center py-24 md:py-32 text-center"
    >
      {/* Ambient radial */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(125,211,252,0.04),transparent_55%)] pointer-events-none" />

      <motion.div
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.06, ease: EASE }}
        className="relative h-16 w-16 rounded-3xl grid place-items-center mb-6"
        style={{ background: "rgba(125,211,252,0.04)", border: "1px solid rgba(125,211,252,0.1)" }}
      >
        {/* Breathing glow behind icon */}
        <motion.div
          className="absolute inset-0 rounded-3xl"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "radial-gradient(circle at 50% 35%, rgba(125,211,252,0.08), transparent 70%)" }}
        />
        <CalendarDays className="h-6 w-6 relative z-10" style={{ color: "rgba(125,211,252,0.35)" }} strokeWidth={1.5} />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.14, ease: EASE }}
        className="text-[15px] font-semibold text-white/[0.65] tracking-tight"
      >
        Nothing scheduled
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.32, delay: 0.22 }}
        className="text-[12px] text-white/[0.45] mt-2 leading-relaxed"
      >
        Add a task to begin your day
      </motion.p>
    </motion.div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({
  groups,
  onToggle,
  onEdit,
  onDelete,
}: {
  groups: { label: string; tasks: HorizonTask[]; hour: number }[];
  onToggle: (id: string) => void;
  onEdit: (t: HorizonTask) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="relative"
    >
      {/* Continuous vertical rail behind all groups */}
      <div
        className="absolute left-[27px] md:left-[35px] top-8 bottom-8 w-px pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(125,211,252,0.12) 8%, rgba(125,211,252,0.12) 92%, transparent)",
        }}
      />
      {groups.map(({ label, tasks, hour }, gi) => (
        <TimelineGroup
          key={label}
          timeLabel={label}
          tasks={tasks}
          groupIndex={gi}
          isLast={gi === groups.length - 1}
          hour={hour}
          globalIndex={groups.slice(0, gi).reduce((acc, g) => acc + g.tasks.length, 0)}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </motion.div>
  );
}

// ─── Timeline group ───────────────────────────────────────────────────────────

/** Colour band for the timeline node based on hour of day */
function getHourAccent(hour: number): { outer: string; core: string; glow: string } {
  if (hour < 6)  return { outer: "border-indigo-400/30",  core: "bg-indigo-300/70",  glow: "rgba(129,140,248,0.35)" };
  if (hour < 12) return { outer: "border-sky-400/35",     core: "bg-sky-300/80",     glow: "rgba(147,197,253,0.38)" };
  if (hour < 17) return { outer: "border-amber-400/35",   core: "bg-amber-300/80",   glow: "rgba(251,191,36,0.38)" };
  if (hour < 20) return { outer: "border-orange-400/35",  core: "bg-orange-300/75",  glow: "rgba(251,146,60,0.38)" };
  return          { outer: "border-violet-400/30",  core: "bg-violet-300/70",  glow: "rgba(167,139,250,0.35)" };
}

function TimelineGroup({
  timeLabel,
  tasks,
  groupIndex,
  isLast,
  hour,
  globalIndex,
  onToggle,
  onEdit,
  onDelete,
}: {
  timeLabel: string;
  tasks: HorizonTask[];
  groupIndex: number;
  isLast: boolean;
  hour: number;
  globalIndex: number;
  onToggle: (id: string) => void;
  onEdit: (t: HorizonTask) => void;
  onDelete: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const allCompleted = tasks.every((t) => t.completed);
  const accent = getHourAccent(hour);

  return (
    <motion.div
      ref={ref}
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE, delay: groupIndex * 0.06 } },
      }}
      className="flex gap-0 mb-6"
    >
      {/* ── Left: node column ─────────────────────────────────────── */}
      <div className="flex flex-col items-center shrink-0 w-14 md:w-[72px] relative z-10">

        {/* Time label */}
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.28, delay: groupIndex * 0.06 + 0.05, ease: EASE }}
          className="text-[9px] md:text-[10px] font-semibold tracking-[0.1em] uppercase tabular-nums whitespace-nowrap pt-1 leading-none"
          style={{ color: allCompleted ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.65)" }}
        >
          {timeLabel}
        </motion.span>

        {/* Node */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={inView ? { scale: 1, opacity: 1 } : {}}
          transition={{ type: "spring", stiffness: 360, damping: 22, delay: groupIndex * 0.06 + 0.1 }}
          className="mt-2 relative flex items-center justify-center shrink-0"
          style={{ width: 22, height: 22 }}
        >
          {/* Ambient pulse — only for incomplete groups */}
          {!allCompleted && (
            <motion.span
              className="absolute rounded-full"
              style={{
                inset: -7,
                background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`,
              }}
              animate={{ opacity: [0, 0.8, 0], scale: [0.7, 1.2, 0.7] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: groupIndex * 0.5 }}
            />
          )}
          {/* Outer ring */}
          <span className={cn(
            "absolute inset-[-4px] rounded-full border-[1.5px] transition-all duration-500",
            allCompleted ? "border-white/[0.08]" : accent.outer,
          )} />
          {/* Inner dot */}
          <span className={cn(
            "h-[8px] w-[8px] rounded-full block transition-all duration-500",
            allCompleted
              ? "bg-white/20"
              : `${accent.core} shadow-[0_0_12px_var(--node-glow,rgba(255,255,255,0.4))]`,
          )}
          style={allCompleted ? {} : { "--node-glow": accent.glow } as React.CSSProperties}
          />
        </motion.div>

        {/* Spacer below node (the rail is rendered as an absolute element in Timeline) */}
        {!isLast && (
          <div className="flex-1 min-h-[28px]" />
        )}
      </div>

      {/* ── Right: Task cards ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 pl-3 md:pl-4 space-y-2.5 pb-0">
        {tasks.map((task, i) => (
          <TimelineTaskCard
            key={task.id}
            task={task}
            index={globalIndex + i}
            onToggle={() => onToggle(task.id)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Timeline task card ───────────────────────────────────────────────────────

function TimelineTaskCard({
  task,
  index,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: HorizonTask;
  index: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const p = PRIORITY_CONFIG[task.priority];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 12, y: 5 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: -6, scale: 0.97 }}
      transition={{ duration: 0.3, delay: index * 0.045, ease: EASE }}
      whileHover={task.completed ? {} : { y: -2, transition: { duration: 0.18, ease: EASE } }}
      className="group relative rounded-2xl overflow-hidden transition-all duration-300"
      style={task.completed ? {
        opacity: 0.3,
        border: "1px solid rgba(125,211,252,0.05)",
      } : {
        border: "1px solid rgba(125,211,252,0.08)",
        background: "rgba(125,211,252,0.025)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.3),inset 0 1px 0 rgba(125,211,252,0.04)",
      }}
      onMouseEnter={e => { if (!task.completed) { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(125,211,252,0.045)"; el.style.borderColor = "rgba(125,211,252,0.14)"; el.style.boxShadow = "0 6px 32px rgba(0,0,0,0.45),inset 0 1px 0 rgba(125,211,252,0.07)"; } }}
      onMouseLeave={e => { if (!task.completed) { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(125,211,252,0.025)"; el.style.borderColor = "rgba(125,211,252,0.08)"; el.style.boxShadow = "0 2px 16px rgba(0,0,0,0.3),inset 0 1px 0 rgba(125,211,252,0.04)"; } }}
    >
      {/* Top edge highlight */}
      {!task.completed && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/[0.18] to-transparent pointer-events-none z-10" />
      )}

      {/* Left priority stripe */}
      <div className={cn(
        "absolute top-3 bottom-3 left-0 w-[2px] rounded-r-full transition-opacity duration-300",
        PRIORITY_STRIPE[task.priority],
        task.completed ? "opacity-15" : "opacity-60",
      )} />

      {/* ── Collapsed header ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v); }}
        className="w-full flex items-start gap-3.5 px-4 md:px-5 py-[18px] text-left cursor-pointer"
      >
        {/* Checkbox */}
        <motion.button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.82 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn(
            "mt-[2px] h-[18px] w-[18px] shrink-0 rounded-[5px] border-[1.5px] grid place-items-center transition-all duration-200",
            task.completed
              ? "border-sky-300/70 bg-sky-300/70"
              : "border-white/[0.17] hover:border-sky-300/50 hover:bg-sky-300/[0.06]",
          )}
        >
          <AnimatePresence initial={false}>
            {task.completed && (
              <motion.span
                key="check"
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 550, damping: 24 }}
              >
                <Check className="h-2.5 w-2.5 text-[#050a10]" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <motion.p
            layout
            className={cn(
              "text-[14px] md:text-[15px] font-semibold leading-snug tracking-tight",
              task.completed ? "line-through text-white/[0.2]" : "text-white/[0.86]",
            )}
          >
            {task.title}
          </motion.p>
          <div className="flex items-center gap-2 mt-1.5">
            <Clock className="h-[10px] w-[10px] text-white/[0.45] shrink-0" />
            <span className="text-[10px] text-white/[0.55] tabular-nums tracking-wide">
              {format12Hour(task.taskTime)}
            </span>
            {task.notificationEnabled && (
              <>
                <span className="text-white/[0.1] text-[10px] select-none">·</span>
                <Bell className="h-[9px] w-[9px] text-white/[0.50]" />
              </>
            )}
          </div>
        </div>

        {/* Right controls: quick-delete + expand chevron */}
        <div className="flex items-center gap-0.5 shrink-0 mt-1">
          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 24 }}
            className="opacity-60 md:opacity-0 md:group-hover:opacity-100 h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-150 hover:bg-red-500/[0.1] text-white/[0.55] hover:text-red-400/80"
            aria-label="Delete task"
          >
            <Trash2 className="h-3 w-3" />
          </motion.button>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="shrink-0 text-white/[0.32] group-hover:text-white/[0.55] transition-colors duration-200 h-6 w-5 flex items-center justify-center"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="overflow-hidden"
          >
            {/* Separator */}
            <div className="mx-4 md:mx-5 h-px bg-gradient-to-r from-transparent via-sky-300/[0.1] to-transparent" />

            <div className="px-4 md:px-5 pt-4 pb-5">
              {task.description && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.04 }}
                  className="text-[13px] text-white/[0.68] leading-relaxed mb-5"
                >
                  {task.description}
                </motion.p>
              )}

              {/* Metadata badges */}
              <motion.div
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.07 }}
                className="flex items-center gap-2 flex-wrap mb-4"
              >
                <span className={cn(
                  "text-[10px] font-medium px-2 py-[3px] rounded-lg border",
                  p.bg, p.color, p.border,
                )}>
                  {p.label}
                </span>
                {task.notificationEnabled && (
                  <span className="flex items-center gap-1 text-[10px] text-white/[0.55] px-2 py-[3px] rounded-lg" style={{ border: "1px solid rgba(125,211,252,0.1)", background: "rgba(125,211,252,0.04)" }}>
                    <Bell className="h-2.5 w-2.5" />
                    Reminder set
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] text-white/[0.55] px-2 py-[3px] rounded-lg" style={{ border: "1px solid rgba(125,211,252,0.1)", background: "rgba(125,211,252,0.04)" }}>
                  <Clock className="h-2.5 w-2.5" />
                  {format12Hour(task.taskTime)}
                </span>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="flex items-center gap-1.5"
              >
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] text-white/[0.68] hover:text-white/[0.90] transition-all duration-150" style={{ background: "rgba(125,211,252,0.04)", border: "1px solid rgba(125,211,252,0.1)" }} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(125,211,252,0.09)";el.style.borderColor="rgba(125,211,252,0.2)";}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(125,211,252,0.04)";el.style.borderColor="rgba(125,211,252,0.1)";}}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-transparent hover:bg-red-500/[0.08] hover:border-red-500/[0.18] text-[12px] text-red-400/60 hover:text-red-400/90 transition-all duration-150"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Task modal ───────────────────────────────────────────────────────────────

function TaskModal({
  open,
  onClose,
  defaultDate,
  editingTask,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  editingTask: HorizonTask | null;
  onSubmit: (input: HorizonTaskInput) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleReminderToggle = async (
    current: boolean,
    onChange: (v: boolean) => void,
  ) => {
    if (current) {
      onChange(false);
      return;
    }
    const status = getNotificationStatus();
    if (status === "unsupported") {
      toast.error("Push notifications aren't supported in this browser.");
      return;
    }
    if (status === "unconfigured") {
      toast.error("Notification service isn't configured yet.");
      return;
    }
    if (status === "denied") {
      toast.error("Notifications are blocked. Enable them in your browser settings, then try again.");
      return;
    }
    if (status === "granted") {
      onChange(true);
      return;
    }
    const result = await requestNotificationPermission();
    if (result === "granted") {
      onChange(true);
    } else if (result === "denied") {
      toast.error("Permission denied — reminder won't be sent.");
    }
  };

  const getDefaultValues = useCallback((): TaskFormValues => {
    if (editingTask) {
      const [hStr, mStr] = editingTask.taskTime.split(":");
      const h = parseInt(hStr, 10);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return {
        title: editingTask.title,
        description: editingTask.description ?? "",
        taskTimeHour: String(h12).padStart(2, "0"),
        taskTimeMinute: mStr ?? "00",
        taskTimeAmpm: ampm,
        priority: editingTask.priority,
        notificationEnabled: editingTask.notificationEnabled,
      };
    }
    return {
      title: "",
      description: "",
      taskTimeHour: "09",
      taskTimeMinute: "00",
      taskTimeAmpm: "AM",
      priority: "medium",
      notificationEnabled: true,
    };
  }, [editingTask]);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (open) reset(getDefaultValues());
  }, [open, editingTask, reset, getDefaultValues]);

  const onValid = async (values: TaskFormValues) => {
    setSubmitting(true);
    const h = parseInt(values.taskTimeHour, 10);
    const h24 = values.taskTimeAmpm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    const taskTime = `${String(h24).padStart(2, "0")}:${values.taskTimeMinute}`;
    await onSubmit({
      title: values.title,
      description: values.description || null,
      taskDate: defaultDate,
      taskTime,
      priority: values.priority as Priority,
      notificationEnabled: values.notificationEnabled,
    });
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid rgba(125,211,252,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        {/* Top edge highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/[0.18] to-transparent pointer-events-none z-10" />

        <DialogHeader className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "rgba(125,211,252,0.07)" }}>
          <DialogTitle className="text-[14px] font-semibold tracking-tight text-white/85">
            {editingTask ? "Edit task" : "New task"}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-white/25 mt-0.5 tracking-wide">
            {formatDisplayDate(defaultDate)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] font-medium text-white/30 mb-1.5 block uppercase tracking-[0.1em]">
              Title
            </label>
            <input
              {...register("title")}
              placeholder="What needs to be done?"
              autoFocus
              className={cn(
                "w-full rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-[14px] outline-none transition-all duration-150 placeholder:text-white/[0.15]",
                errors.title
                  ? "border-red-400/30 focus:border-red-400/50"
                  : "focus:bg-white/[0.03]",
                "border"
              )}
              style={!errors.title ? { borderColor: "rgba(125,211,252,0.1)" } : undefined}
              onFocus={e => { if (!errors.title) (e.target as HTMLElement).style.borderColor="rgba(125,211,252,0.25)"; }}
              onBlur={e => { if (!errors.title) (e.target as HTMLElement).style.borderColor="rgba(125,211,252,0.1)"; }}
            />
            {errors.title && (
              <motion.p
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-red-400/60 mt-1"
              >
                {errors.title.message}
              </motion.p>
            )}
          </div>

          {/* Time */}
          <div>
            <label className="text-[10px] font-medium text-white/30 mb-1.5 block uppercase tracking-[0.1em]">
              Time
            </label>
            <div className="flex items-center gap-2">
              <Controller name="taskTimeHour" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="flex-1 bg-white/[0.03] text-sm rounded-xl h-10" style={{ borderColor: "rgba(125,211,252,0.1)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--surface-2)] border-white/[0.08] max-h-52">
                    {HOURS_12.map((h) => <SelectItem key={h} value={h} className="text-sm">{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <span className="text-white/[0.15] text-sm font-medium shrink-0">:</span>
              <Controller name="taskTimeMinute" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="flex-1 bg-white/[0.03] text-sm rounded-xl h-10" style={{ borderColor: "rgba(125,211,252,0.1)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--surface-2)] border-white/[0.08] max-h-52">
                    {ALL_MINUTES.map((m) => <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <Controller name="taskTimeAmpm" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-20 bg-white/[0.03] text-sm rounded-xl h-10" style={{ borderColor: "rgba(125,211,252,0.1)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--surface-2)] border-white/[0.08]">
                    <SelectItem value="AM" className="text-sm">AM</SelectItem>
                    <SelectItem value="PM" className="text-sm">PM</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-medium text-white/30 mb-1.5 block uppercase tracking-[0.1em]">
              Description <span className="normal-case text-white/[0.15] tracking-normal font-normal">(optional)</span>
            </label>
            <textarea
              {...register("description")}
              rows={2}
              placeholder="Add notes…"
              className="w-full rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-[14px] outline-none transition-all duration-150 placeholder:text-white/[0.15] resize-none border"
              style={{ borderColor: "rgba(125,211,252,0.1)" }}
              onFocus={e => (e.target as HTMLElement).style.borderColor="rgba(125,211,252,0.25)"}
              onBlur={e => (e.target as HTMLElement).style.borderColor="rgba(125,211,252,0.1)"}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] font-medium text-white/30 mb-1.5 block uppercase tracking-[0.1em]">
              Priority
            </label>
            <Controller name="priority" control={control} render={({ field }) => (
              <div className="flex gap-2">
                {(["low", "medium", "high"] as Priority[]).map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const active = field.value === p;
                  return (
                    <motion.button
                      key={p}
                      type="button"
                      onClick={() => field.onChange(p)}
                      whileTap={{ scale: 0.96 }}
                      className={cn(
                        "flex-1 py-2 rounded-xl border text-[12px] font-medium transition-all duration-150",
                        active
                          ? cn(cfg.bg, cfg.border, cfg.color)
                          : "text-white/[0.25] hover:text-white/[0.5]",
                      )}
                    >
                      {cfg.label}
                    </motion.button>
                  );
                })}
              </div>
            )} />
          </div>

          {/* Notification toggle — holographic blue */}
          <Controller name="notificationEnabled" control={control} render={({ field }) => (
            <motion.button
              type="button"
              onClick={() => handleReminderToggle(field.value, field.onChange)}
              whileTap={{ scale: 0.98 }}
              style={field.value ? {
                border: "1px solid rgba(125,211,252,0.35)",
                background: "rgba(125,211,252,0.07)",
                boxShadow: "0 0 18px rgba(125,211,252,0.12), inset 0 0 12px rgba(125,211,252,0.04)",
              } : {
                border: "1px solid rgba(125,211,252,0.1)",
                background: "transparent",
                boxShadow: "none",
              }}
              className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all duration-300"
            >
              <AnimatePresence mode="wait">
                {field.value ? (
                  <motion.span key="on" initial={{ scale: 0.6, opacity: 0, rotate: -15 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                    <Bell className="h-4 w-4 shrink-0" style={{ color: "#7DD3FC", filter: "drop-shadow(0 0 6px rgba(125,211,252,0.6))" }} />
                  </motion.span>
                ) : (
                  <motion.span key="off" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <BellOff className="h-4 w-4 text-white/[0.18] shrink-0" />
                  </motion.span>
                )}
              </AnimatePresence>
              <div className="text-left flex-1">
                <p className="text-[13px] font-medium leading-none transition-colors duration-200"
                  style={{ color: field.value ? "rgba(125,211,252,0.9)" : "rgba(255,255,255,0.45)" }}>
                  {field.value ? "Reminder active" : "Enable reminder"}
                </p>
                <p className="text-[11px] mt-0.5 transition-colors duration-200"
                  style={{ color: field.value ? "rgba(125,211,252,0.45)" : "rgba(255,255,255,0.18)" }}>
                  {field.value ? "You'll be notified at task time" : "No notification scheduled"}
                </p>
              </div>
              {/* Blue holographic toggle switch */}
              <div
                className="relative h-5 w-9 rounded-full shrink-0 transition-all duration-300"
                style={field.value ? {
                  background: "rgba(125,211,252,0.25)",
                  border: "1px solid rgba(125,211,252,0.5)",
                  boxShadow: "0 0 10px rgba(125,211,252,0.3)",
                } : {
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.13)",
                }}
              >
                <motion.span
                  animate={{ x: field.value ? 16 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  className="absolute top-[1px] left-[1px] h-4 w-4 rounded-full"
                  style={field.value ? {
                    background: "radial-gradient(circle at 35% 35%, #93C5FD, #7DD3FC)",
                    boxShadow: "0 0 8px rgba(125,211,252,0.7)",
                  } : {
                    background: "rgba(255,255,255,0.25)",
                    boxShadow: "none",
                  }}
                />
              </div>
            </motion.button>
          )} />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white/[0.28] hover:text-white/[0.55] transition-all duration-150 border"
              style={{ borderColor: "rgba(125,211,252,0.1)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor="rgba(125,211,252,0.2)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor="rgba(125,211,252,0.1)"}
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ opacity: submitting ? 1 : 0.88 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-25 transition-opacity"
              style={{ background: "linear-gradient(135deg,rgba(125,211,252,0.9),rgba(147,197,253,0.85))", color: "#050609", boxShadow: "0 2px 16px rgba(125,211,252,0.22)" }}
            >
              {submitting ? "Saving…" : editingTask ? "Save changes" : "Add task"}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
