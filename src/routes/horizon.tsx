import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// ─── Month animation variants ─────────────────────────────────────────────────

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

  const { tasksForDate, datesWithTasks, add, update, toggle, remove } = useHorizon();

  const selectedTasks = selectedDate ? tasksForDate(selectedDate) : [];
  const timelineGroups = groupByHour(selectedTasks);

  const prevMonth = useCallback(() => {
    setDirection(-1);
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setDirection(1);
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
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
  const remainder = 42 - cells.length;
  for (let d = 1; d <= remainder; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, currentMonth: false, day: d });
  }

  const monthKey = `${viewYear}-${viewMonth}`;

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-10 pt-5 pb-6">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="flex items-center gap-3 mb-7"
        >
          <div className="h-8 w-8 rounded-xl bg-white/[0.05] border border-white/[0.07] grid place-items-center">
            <CalendarDays className="h-4 w-4 text-white/50" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold tracking-tight leading-none">Horizon</h1>
            <p className="text-[11px] text-copy-muted mt-0.5">Calendar & tasks</p>
          </div>
        </motion.div>

        {/* Month navigation */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
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
            <button
              onClick={goToday}
              className="hidden sm:flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 border border-white/[0.07] hover:border-white/[0.14] hover:text-white/70 transition-all duration-200"
            >
              Today
            </button>
            {[{ action: prevMonth, icon: ChevronLeft, label: "Previous" }, { action: nextMonth, icon: ChevronRight, label: "Next" }].map(({ action, icon: Icon, label }) => (
              <button
                key={label}
                onClick={action}
                className="h-8 w-8 rounded-lg border border-white/[0.07] hover:border-white/[0.14] grid place-items-center text-white/35 hover:text-white/70 transition-all duration-200"
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1.5">
          {DAYS.map((d) => (
            <div key={d} className="text-[10px] font-medium text-white/25 text-center pb-2 tracking-widest uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={monthKey}
            custom={direction}
            variants={gridVariants}
            initial="enter" animate="center" exit="exit"
            className="grid grid-cols-7 gap-1"
          >
            {cells.map(({ dateStr, currentMonth, day }) => {
              const isToday = dateStr === todayKey;
              const isSelected = dateStr === selectedDate;
              const hasTasks = datesWithTasks.has(dateStr);
              const taskCount = hasTasks ? tasksForDate(dateStr).length : 0;

              return (
                <motion.button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  whileHover={{ scale: 1.06, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 450, damping: 26 }}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all duration-150",
                    !currentMonth && "opacity-[0.18]",
                    isToday
                      ? "bg-white/[0.11] border border-white/[0.2] font-semibold text-foreground shadow-[0_0_20px_rgba(255,255,255,0.03)]"
                      : isSelected
                        ? "bg-white/[0.08] border border-white/[0.12] text-foreground"
                        : "hover:bg-white/[0.04] text-white/50 hover:text-white/80 border border-transparent",
                  )}
                >
                  <span className="text-[12px] md:text-[13px]">{day}</span>
                  {hasTasks && (
                    <span className={cn(
                      "mt-0.5 h-[3px] w-[3px] rounded-full",
                      isToday || isSelected ? "bg-white/60" : "bg-white/20",
                    )} />
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute inset-0 z-30 bg-background flex flex-col"
          >
            {/* Top accent gradient */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.012] to-transparent pointer-events-none" />

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05, ease: EASE }}
              className="shrink-0 flex items-center justify-between px-5 md:px-10 pt-5 md:pt-7 pb-4 border-b border-white/[0.05]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  onClick={() => setSelectedDate(null)}
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 text-white/35 hover:text-white/70 transition-colors duration-150 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-[13px] font-medium hidden sm:block">Calendar</span>
                </motion.button>

                <div className="h-3.5 w-px bg-white/[0.08] shrink-0 hidden sm:block" />

                <div className="min-w-0">
                  <motion.h2
                    key={selectedDate}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[14px] md:text-[15px] font-semibold tracking-tight truncate"
                  >
                    {formatDisplayDate(selectedDate)}
                  </motion.h2>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {selectedTasks.length === 0
                      ? "No tasks scheduled"
                      : selectedTasks.filter((t) => !t.completed).length === 0
                        ? "All done"
                        : `${selectedTasks.filter((t) => !t.completed).length} remaining`}
                  </p>
                </div>
              </div>

              <motion.button
                onClick={() => { setEditingTask(null); setModalOpen(true); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.09] hover:bg-white/[0.09] hover:border-white/[0.14] text-[13px] font-medium text-white/70 hover:text-white transition-all duration-200"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Task</span>
              </motion.button>
            </motion.div>

            {/* Timeline */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
                <AnimatePresence mode="popLayout" initial={false}>
                  {selectedTasks.length === 0 ? (
                    <EmptyDay key="empty" />
                  ) : (
                    <Timeline
                      key="timeline"
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="flex flex-col items-center justify-center py-20 md:py-28 text-center"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
        className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] grid place-items-center mb-5"
      >
        <CalendarDays className="h-6 w-6 text-white/15" strokeWidth={1.5} />
      </motion.div>
      <p className="text-[14px] font-medium text-white/35">Nothing scheduled</p>
      <p className="text-[12px] text-white/20 mt-1.5">Tap Add Task to create one</p>
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
    <div className="space-y-0">
      {groups.map(({ label, tasks }, gi) => (
        <TimelineGroup
          key={label}
          timeLabel={label}
          tasks={tasks}
          isLast={gi === groups.length - 1}
          globalIndex={groups.slice(0, gi).reduce((acc, g) => acc + g.tasks.length, 0)}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// ─── Timeline group (one hour) ────────────────────────────────────────────────

function TimelineGroup({
  timeLabel,
  tasks,
  isLast,
  globalIndex,
  onToggle,
  onEdit,
  onDelete,
}: {
  timeLabel: string;
  tasks: HorizonTask[];
  isLast: boolean;
  globalIndex: number;
  onToggle: (id: string) => void;
  onEdit: (t: HorizonTask) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.28, ease: EASE }}
      className="flex gap-0"
    >
      {/* ── Left: Timeline column ─────────────────────────────────── */}
      <div className="flex flex-col items-center shrink-0 w-14 md:w-16">
        {/* Time label */}
        <span className="text-[10px] md:text-[11px] font-medium text-white/25 leading-none pt-[18px] whitespace-nowrap">
          {timeLabel}
        </span>
        {/* Node */}
        <div className="mt-2 h-2 w-2 rounded-full bg-white/[0.2] border border-white/[0.35] shadow-[0_0_6px_rgba(255,255,255,0.08)] shrink-0" />
        {/* Connector line — extends down if not last */}
        {!isLast && (
          <div className="w-px flex-1 mt-1 mb-0 bg-gradient-to-b from-white/[0.1] to-transparent min-h-[24px]" />
        )}
      </div>

      {/* ── Right: Task cards ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 pb-6 md:pb-8 pl-3 md:pl-4 space-y-2.5">
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
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -4, scale: 0.97 }}
      transition={{ duration: 0.24, delay: index * 0.035, ease: EASE }}
      whileHover={{ y: -1.5, transition: { duration: 0.15 } }}
      className={cn(
        "rounded-2xl border overflow-hidden transition-all duration-250 group",
        task.completed
          ? "opacity-40 border-white/[0.04] bg-transparent"
          : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.11] hover:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]",
      )}
    >
      {/* Main row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 px-4 py-4 md:py-4.5 text-left"
      >
        {/* Checkbox */}
        <motion.button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          whileTap={{ scale: 0.82 }}
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 rounded-md border-[1.5px] grid place-items-center transition-all duration-200",
            task.completed
              ? "bg-white/70 border-white/70"
              : "border-white/15 hover:border-white/35",
          )}
        >
          {task.completed && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <Check className="h-3 w-3 text-background" strokeWidth={2.5} />
            </motion.span>
          )}
        </motion.button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Priority badge */}
            <span className={cn("h-[5px] w-[5px] rounded-full shrink-0 mt-px", p.dot)} />
            <p className={cn(
              "text-[14px] font-medium leading-snug transition-all duration-200",
              task.completed ? "line-through text-white/25" : "text-white/85",
            )}>
              {task.title}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-[11px] w-[11px] text-white/20 shrink-0" />
            <span className="text-[11px] text-white/25">{format12Hour(task.taskTime)}</span>
            {task.notificationEnabled && (
              <span className="ml-1 text-[11px] text-white/20 flex items-center gap-1">
                <Bell className="h-[10px] w-[10px]" />
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
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
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-0 pb-4 border-t border-white/[0.04]">
              {task.description && (
                <p className="text-[13px] text-white/40 mt-3 mb-3 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-md border",
                  p.bg, p.color, p.border,
                )}>
                  {p.label} priority
                </span>
                {task.notificationEnabled && (
                  <span className="flex items-center gap-1 text-[10px] text-white/25">
                    <Bell className="h-2.5 w-2.5" />
                    Reminder on
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 mt-3.5">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/70 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] transition-all duration-150"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 text-[12px] text-white/25 hover:text-red-400/80 px-2.5 py-1.5 rounded-lg hover:bg-red-500/[0.06] transition-all duration-150"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
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
          <DialogDescription className="text-[11px] text-white/30 mt-0.5">
            {formatDisplayDate(defaultDate)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[11px] font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Title</label>
            <input
              {...register("title")}
              placeholder="What needs to be done?"
              autoFocus
              className={cn(
                "w-full rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-[14px] outline-none transition-all duration-150 placeholder:text-white/20",
                errors.title
                  ? "border-red-400/30 focus:border-red-400/50"
                  : "border-white/[0.07] focus:border-white/[0.16] focus:bg-white/[0.05]",
              )}
            />
            {errors.title && <p className="text-[11px] text-red-400/70 mt-1">{errors.title.message}</p>}
          </div>

          {/* Time */}
          <div>
            <label className="text-[11px] font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Time</label>
            <div className="flex items-center gap-2">
              <Controller
                name="taskTimeHour"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="flex-1 bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14] text-sm rounded-xl h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-white/[0.08] max-h-52">
                      {HOURS_12.map((h) => <SelectItem key={h} value={h} className="text-sm">{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              <span className="text-white/20 text-sm font-medium shrink-0">:</span>
              <Controller
                name="taskTimeMinute"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="flex-1 bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14] text-sm rounded-xl h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-white/[0.08] max-h-52">
                      {ALL_MINUTES.map((m) => <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                name="taskTimeAmpm"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-20 bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14] text-sm rounded-xl h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-white/[0.08]">
                      <SelectItem value="AM" className="text-sm">AM</SelectItem>
                      <SelectItem value="PM" className="text-sm">PM</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-white/40 mb-1.5 block uppercase tracking-wider">
              Description <span className="normal-case text-white/20 tracking-normal">(optional)</span>
            </label>
            <textarea
              {...register("description")}
              rows={2}
              placeholder="Add details…"
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-[14px] outline-none transition-all duration-150 placeholder:text-white/20 focus:border-white/[0.16] focus:bg-white/[0.05] resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Priority</label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as Priority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    const active = field.value === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => field.onChange(p)}
                        className={cn(
                          "flex-1 py-2 rounded-xl border text-[12px] font-medium transition-all duration-150",
                          active
                            ? cn(cfg.bg, cfg.border, cfg.color)
                            : "border-white/[0.06] text-white/30 hover:text-white/55 hover:border-white/[0.1]",
                        )}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>

          {/* Notification toggle */}
          <Controller
            name="notificationEnabled"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-all duration-200",
                  field.value
                    ? "border-white/[0.12] bg-white/[0.04]"
                    : "border-white/[0.06] hover:border-white/[0.1]",
                )}
              >
                {field.value ? <Bell className="h-4 w-4 text-white/50 shrink-0" /> : <BellOff className="h-4 w-4 text-white/20 shrink-0" />}
                <div className="text-left flex-1">
                  <p className="text-[13px] font-medium text-white/60 leading-none">
                    {field.value ? "Reminder enabled" : "Enable reminder"}
                  </p>
                  <p className="text-[11px] text-white/25 mt-0.5">{field.value ? "You'll be notified" : "No notification"}</p>
                </div>
                <div className={cn(
                  "h-5 w-9 rounded-full border relative shrink-0 transition-all duration-200",
                  field.value ? "bg-white/70 border-white/70" : "bg-transparent border-white/15",
                )}>
                  <span className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition-all duration-200",
                    field.value ? "left-4 bg-background" : "left-0.5 bg-white/30",
                  )} />
                </div>
              </button>
            )}
          />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.07] text-[13px] font-medium text-white/35 hover:text-white/60 hover:border-white/[0.12] transition-all duration-150"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-[13px] font-medium disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              {submitting ? "Saving…" : editingTask ? "Save changes" : "Add task"}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
