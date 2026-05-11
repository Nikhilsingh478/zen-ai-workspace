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
import { useState, useEffect, useCallback, useRef } from "react";
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

// Stagger container — children fade+slide up one by one
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

// ─── Group tasks by hour ──────────────────────────────────────────────────────

function groupByHour(tasks: HorizonTask[]): { label: string; tasks: HorizonTask[] }[] {
  const map = new Map<string, HorizonTask[]>();
  const sorted = [...tasks].sort((a, b) => a.taskTime.localeCompare(b.taskTime));
  for (const task of sorted) {
    const [h] = task.taskTime.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const label = `${h12} ${ampm}`;
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(task);
  }
  return Array.from(map.entries()).map(([label, tasks]) => ({ label, tasks }));
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

      {/* ── Calendar view ─────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-10 pt-5 pb-6">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="flex items-center gap-3 mb-7"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
            className="h-8 w-8 rounded-xl bg-white/[0.05] border border-white/[0.07] grid place-items-center"
          >
            <CalendarDays className="h-4 w-4 text-white/50" strokeWidth={1.75} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}
          >
            <h1 className="text-[16px] font-semibold tracking-tight leading-none">Horizon</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Calendar & tasks</p>
          </motion.div>

          {/* Notification status pill — shown only when relevant */}
          <AnimatePresence>
            {tasksWithReminders > 0 && notifStatus === "denied" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-[10px] text-white/28"
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
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[10px] text-white/22"
              >
                <BellRing className="h-2.5 w-2.5" />
                {tasksWithReminders} reminder{tasksWithReminders > 1 ? "s" : ""}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Test notification button — only visible when permission is granted */}
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
                    console.error("[horizon] test notification error:", err);
                  } finally {
                    setTestingNotif(false);
                  }
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-[10px] text-white/28 hover:text-white/55 hover:border-white/[0.12] transition-all duration-200 disabled:opacity-40"
                title="Send a test notification to verify delivery"
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
          className="flex items-center justify-between mb-5"
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.h2
              key={monthKey}
              custom={direction}
              variants={monthVariants}
              initial="enter" animate="center" exit="exit"
              className="text-xl md:text-[22px] font-semibold tracking-tight"
            >
              {MONTHS[viewMonth]} {viewYear}
            </motion.h2>
          </AnimatePresence>

          <div className="flex items-center gap-1.5">
            <motion.button
              onClick={goToday}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="hidden sm:flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 border border-white/[0.07] hover:border-white/[0.14] hover:text-white/70 transition-all duration-200"
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
                className="h-8 w-8 rounded-lg border border-white/[0.07] hover:border-white/[0.14] grid place-items-center text-white/30 hover:text-white/70 transition-all duration-200"
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Day-of-week headers — staggered entrance */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-7 mb-1.5"
        >
          {DAYS.map((d) => (
            <motion.div
              key={d}
              variants={staggerItem}
              className="text-[10px] font-medium text-white/20 text-center pb-2 tracking-widest uppercase"
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
            className="grid grid-cols-7 gap-1"
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
                  animate={{ opacity: currentMonth ? 1 : 0.18, scale: 1 }}
                  transition={{ duration: 0.22, delay: cellIndex * 0.006, ease: EASE }}
                  whileHover={{ scale: 1.07, y: -1.5 }}
                  whileTap={{ scale: 0.93 }}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-colors duration-150",
                    isToday
                      ? "bg-white/[0.11] border border-white/[0.2] font-semibold text-foreground"
                      : isSelected
                        ? "bg-white/[0.08] border border-white/[0.12] text-foreground"
                        : "hover:bg-white/[0.04] text-white/50 hover:text-white/80 border border-transparent",
                  )}
                >
                  {/* Today breathing glow */}
                  {isToday && (
                    <motion.span
                      className="absolute inset-0 rounded-xl"
                      animate={{ boxShadow: ["0 0 0px rgba(255,255,255,0)", "0 0 14px rgba(255,255,255,0.05)", "0 0 0px rgba(255,255,255,0)"] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <span className="text-[12px] md:text-[13px] relative z-10">{day}</span>
                  {hasTasks && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className={cn(
                        "mt-0.5 h-[3px] w-[3px] rounded-full relative z-10",
                        isToday || isSelected ? "bg-white/60" : "bg-white/20",
                      )}
                    />
                  )}
                  {taskCount > 1 && (
                    <span className={cn(
                      "absolute top-0.5 right-1 text-[8px] font-medium",
                      isToday || isSelected ? "text-white/50" : "text-white/15",
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

      {/* ── Fullscreen task experience ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="absolute inset-0 z-30 bg-background flex flex-col"
          >
            {/* Ambient top gradient */}
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/[0.012] to-transparent pointer-events-none" />

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.06, ease: EASE }}
              className="shrink-0 flex items-center justify-between px-5 md:px-10 pt-5 md:pt-7 pb-4 border-b border-white/[0.05]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  onClick={() => setSelectedDate(null)}
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="flex items-center gap-1.5 text-white/35 hover:text-white/70 transition-colors duration-150 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-[13px] font-medium hidden sm:block">Calendar</span>
                </motion.button>

                <div className="h-3.5 w-px bg-white/[0.08] shrink-0 hidden sm:block" />

                <div className="min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={selectedDate}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="text-[14px] md:text-[15px] font-semibold tracking-tight truncate"
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
                      className="text-[11px] text-white/28 mt-0.5"
                    >
                      {selectedTasks.length === 0
                        ? "No tasks scheduled"
                        : remaining === 0
                          ? "All done ✓"
                          : `${remaining} of ${selectedTasks.length} remaining`}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              <motion.button
                onClick={() => { setEditingTask(null); setModalOpen(true); }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.09] hover:bg-white/[0.09] hover:border-white/[0.14] text-[13px] font-medium text-white/65 hover:text-white/90 transition-all duration-200"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Task</span>
              </motion.button>
            </motion.div>

            {/* Timeline scroll area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="flex flex-col items-center justify-center py-20 md:py-28 text-center"
    >
      <motion.div
        initial={{ scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.06, ease: EASE }}
        className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] grid place-items-center mb-5"
      >
        <CalendarDays className="h-6 w-6 text-white/15" strokeWidth={1.5} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.14, ease: EASE }}
        className="text-[14px] font-medium text-white/30"
      >
        Nothing scheduled
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.22 }}
        className="text-[12px] text-white/18 mt-1.5"
      >
        Tap Add Task to create one
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
  groups: { label: string; tasks: HorizonTask[] }[];
  onToggle: (id: string) => void;
  onEdit: (t: HorizonTask) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="space-y-0"
    >
      {groups.map(({ label, tasks }, gi) => (
        <TimelineGroup
          key={label}
          timeLabel={label}
          tasks={tasks}
          groupIndex={gi}
          isLast={gi === groups.length - 1}
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

function TimelineGroup({
  timeLabel,
  tasks,
  groupIndex,
  isLast,
  globalIndex,
  onToggle,
  onEdit,
  onDelete,
}: {
  timeLabel: string;
  tasks: HorizonTask[];
  groupIndex: number;
  isLast: boolean;
  globalIndex: number;
  onToggle: (id: string) => void;
  onEdit: (t: HorizonTask) => void;
  onDelete: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });

  return (
    <motion.div
      ref={ref}
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE, delay: groupIndex * 0.06 } },
      }}
      className="flex gap-0"
    >
      {/* ── Left: Timeline rail ─────────────────────────────────────── */}
      <div className="flex flex-col items-center shrink-0 w-14 md:w-16">
        {/* Time label */}
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.28, delay: groupIndex * 0.07 + 0.05, ease: EASE }}
          className="text-[10px] md:text-[11px] font-medium text-white/22 leading-none pt-[18px] whitespace-nowrap tabular-nums"
        >
          {timeLabel}
        </motion.span>

        {/* Node — springs in with a subtle glow */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={inView ? { scale: 1, opacity: 1 } : {}}
          transition={{ type: "spring", stiffness: 380, damping: 22, delay: groupIndex * 0.07 + 0.1 }}
          className="mt-2 relative shrink-0"
        >
          {/* Outer glow ring — breathes slowly */}
          <motion.span
            className="absolute inset-[-4px] rounded-full"
            animate={{ opacity: [0, 0.35, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: groupIndex * 0.5 }}
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)" }}
          />
          <span className="h-2 w-2 rounded-full bg-white/[0.22] border border-white/[0.38] shadow-[0_0_8px_rgba(255,255,255,0.1)] block" />
        </motion.div>

        {/* Connector line — draws downward */}
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={inView ? { scaleY: 1, opacity: 1 } : {}}
            transition={{ duration: 0.55, delay: groupIndex * 0.07 + 0.18, ease: EASE }}
            style={{ originY: "top" }}
            className="w-px flex-1 mt-1.5 bg-gradient-to-b from-white/[0.1] via-white/[0.05] to-transparent min-h-[32px]"
          />
        )}
      </div>

      {/* ── Right: Task cards ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 pb-7 md:pb-9 pl-3 md:pl-4 space-y-2.5">
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
      initial={{ opacity: 0, x: 10, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: -6, scale: 0.97 }}
      transition={{ duration: 0.26, delay: index * 0.04, ease: EASE }}
      whileHover={
        task.completed
          ? {}
          : { y: -2, transition: { duration: 0.16, ease: EASE } }
      }
      className={cn(
        "rounded-2xl border overflow-hidden transition-colors duration-200 group",
        task.completed
          ? "opacity-38 border-white/[0.04] bg-transparent"
          : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.055] hover:border-white/[0.12] hover:shadow-[0_10px_40px_-14px_rgba(0,0,0,0.7)]",
      )}
    >
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 px-4 py-4 text-left min-h-[60px]"
      >
        {/* Checkbox */}
        <motion.button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.8 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 rounded-md border-[1.5px] grid place-items-center transition-all duration-200",
            task.completed
              ? "bg-white/70 border-white/70"
              : "border-white/15 hover:border-white/40",
          )}
        >
          <AnimatePresence initial={false}>
            {task.completed && (
              <motion.span
                key="check"
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 550, damping: 22 }}
              >
                <Check className="h-3 w-3 text-background" strokeWidth={2.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <motion.span
              className={cn("h-[5px] w-[5px] rounded-full shrink-0 mt-px", p.dot)}
              animate={{ opacity: task.completed ? 0.4 : 1 }}
            />
            <motion.p
              layout
              className={cn(
                "text-[14px] font-medium leading-snug",
                task.completed ? "line-through text-white/22" : "text-white/82",
              )}
            >
              {task.title}
            </motion.p>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-[11px] w-[11px] text-white/18 shrink-0" />
            <span className="text-[11px] text-white/22">{format12Hour(task.taskTime)}</span>
            {task.notificationEnabled && (
              <Bell className="h-[10px] w-[10px] text-white/18 ml-1" />
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="text-white/15 mt-1 shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-0 pb-4 border-t border-white/[0.04]">
              {task.description && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                  className="text-[13px] text-white/38 mt-3 mb-2 leading-relaxed"
                >
                  {task.description}
                </motion.p>
              )}

              {/* Meta */}
              <motion.div
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.08 }}
                className="flex items-center gap-2 mt-3 flex-wrap"
              >
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-md border",
                  p.bg, p.color, p.border,
                )}>
                  {p.label}
                </span>
                {task.notificationEnabled && (
                  <span className="flex items-center gap-1 text-[10px] text-white/22">
                    <Bell className="h-2.5 w-2.5" />
                    Reminder on
                  </span>
                )}
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="flex items-center gap-1 mt-3.5"
              >
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 text-[12px] text-white/28 hover:text-white/70 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] transition-all duration-150"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 text-[12px] text-white/22 hover:text-red-400/75 px-2.5 py-1.5 rounded-lg hover:bg-red-500/[0.06] transition-all duration-150"
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
      notificationEnabled: false,
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
      <DialogContent className="sm:max-w-md bg-[var(--surface-1)] border border-white/[0.08] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/[0.05]">
          <DialogTitle className="text-[14px] font-semibold">
            {editingTask ? "Edit task" : "New task"}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-white/28 mt-0.5">
            {formatDisplayDate(defaultDate)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[11px] font-medium text-white/38 mb-1.5 block uppercase tracking-wider">
              Title
            </label>
            <input
              {...register("title")}
              placeholder="What needs to be done?"
              autoFocus
              className={cn(
                "w-full rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-[14px] outline-none transition-all duration-150 placeholder:text-white/18",
                errors.title
                  ? "border-red-400/30 focus:border-red-400/50"
                  : "border-white/[0.07] focus:border-white/[0.16] focus:bg-white/[0.05]",
              )}
            />
            {errors.title && (
              <motion.p
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-red-400/65 mt-1"
              >
                {errors.title.message}
              </motion.p>
            )}
          </div>

          {/* Time */}
          <div>
            <label className="text-[11px] font-medium text-white/38 mb-1.5 block uppercase tracking-wider">
              Time
            </label>
            <div className="flex items-center gap-2">
              <Controller name="taskTimeHour" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="flex-1 bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14] text-sm rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--surface-2)] border-white/[0.08] max-h-52">
                    {HOURS_12.map((h) => <SelectItem key={h} value={h} className="text-sm">{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <span className="text-white/18 text-sm font-medium shrink-0">:</span>
              <Controller name="taskTimeMinute" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="flex-1 bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14] text-sm rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--surface-2)] border-white/[0.08] max-h-52">
                    {ALL_MINUTES.map((m) => <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
              <Controller name="taskTimeAmpm" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-20 bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14] text-sm rounded-xl h-10">
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
            <label className="text-[11px] font-medium text-white/38 mb-1.5 block uppercase tracking-wider">
              Description <span className="normal-case text-white/18 tracking-normal">(optional)</span>
            </label>
            <textarea
              {...register("description")}
              rows={2}
              placeholder="Add details…"
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-[14px] outline-none transition-all duration-150 placeholder:text-white/18 focus:border-white/[0.16] focus:bg-white/[0.05] resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] font-medium text-white/38 mb-1.5 block uppercase tracking-wider">
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
                          : "border-white/[0.06] text-white/28 hover:text-white/55 hover:border-white/[0.1]",
                      )}
                    >
                      {cfg.label}
                    </motion.button>
                  );
                })}
              </div>
            )} />
          </div>

          {/* Notification toggle */}
          <Controller name="notificationEnabled" control={control} render={({ field }) => (
            <motion.button
              type="button"
              onClick={() => handleReminderToggle(field.value, field.onChange)}
              whileTap={{ scale: 0.99 }}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200",
                field.value
                  ? "border-white/[0.11] bg-white/[0.04]"
                  : "border-white/[0.06] hover:border-white/[0.1]",
              )}
            >
              <AnimatePresence mode="wait">
                {field.value ? (
                  <motion.span key="on" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Bell className="h-4 w-4 text-white/45 shrink-0" />
                  </motion.span>
                ) : (
                  <motion.span key="off" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <BellOff className="h-4 w-4 text-white/18 shrink-0" />
                  </motion.span>
                )}
              </AnimatePresence>
              <div className="text-left flex-1">
                <p className="text-[13px] font-medium text-white/55 leading-none">
                  {field.value ? "Reminder on" : "Enable reminder"}
                </p>
                <p className="text-[11px] text-white/22 mt-0.5">
                  {field.value ? "You'll be notified at task time" : "No notification"}
                </p>
              </div>
              {/* Toggle switch */}
              <div className={cn(
                "h-5 w-9 rounded-full border relative shrink-0 transition-all duration-250",
                field.value ? "bg-white/65 border-white/65" : "bg-transparent border-white/14",
              )}>
                <motion.span
                  animate={{ x: field.value ? 16 : 2 }}
                  transition={{ type: "spring", stiffness: 450, damping: 26 }}
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full shadow-sm",
                    field.value ? "bg-background" : "bg-white/28",
                  )}
                />
              </div>
            </motion.button>
          )} />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.07] text-[13px] font-medium text-white/32 hover:text-white/60 hover:border-white/[0.12] transition-all duration-150"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ opacity: submitting ? 1 : 0.9 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-[13px] font-semibold disabled:opacity-28 transition-opacity"
            >
              {submitting ? "Saving…" : editingTask ? "Save changes" : "Add task"}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
