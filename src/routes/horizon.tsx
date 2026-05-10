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
  ChevronDown,
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

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/horizon")({
  head: () => ({
    meta: [
      { title: "Horizon — AI Metrics" },
      { name: "description", content: "Premium calendar and task management." },
    ],
  }),
  component: HorizonPage,
});

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── Main page ───────────────────────────────────────────────────────────────

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

  // Calendar grid
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
      {/* ── Calendar view ─────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-10 pt-6 pb-6">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="h-8 w-8 rounded-xl bg-white/[0.06] border border-white/[0.08] grid place-items-center">
            <CalendarDays className="h-4 w-4 text-white/60" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight leading-none">Horizon</h1>
            <p className="text-[11px] text-copy-muted mt-0.5">Calendar & tasks</p>
          </div>
        </motion.div>

        {/* Month navigation */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="flex items-center justify-between mb-6"
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.h2
              key={monthKey}
              custom={direction}
              variants={monthVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-xl md:text-2xl font-semibold tracking-tight"
            >
              {MONTHS[viewMonth]} {viewYear}
            </motion.h2>
          </AnimatePresence>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="hidden sm:flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-copy-secondary border border-white/[0.08] hover:border-white/[0.15] hover:text-foreground transition-all duration-200"
            >
              Today
            </button>
            <button
              onClick={prevMonth}
              className="h-8 w-8 rounded-lg border border-white/[0.08] hover:border-white/[0.15] grid place-items-center text-copy-secondary hover:text-foreground transition-all duration-200"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextMonth}
              className="h-8 w-8 rounded-lg border border-white/[0.08] hover:border-white/[0.15] grid place-items-center text-copy-secondary hover:text-foreground transition-all duration-200"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((d) => (
            <div key={d} className="text-[11px] font-medium text-copy-muted text-center pb-2">
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
            initial="enter"
            animate="center"
            exit="exit"
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
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 group",
                    !currentMonth && "opacity-20",
                    isSelected && !isToday
                      ? "bg-white/[0.09] border border-white/[0.14] text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]"
                      : isToday
                        ? "bg-white/[0.1] border border-white/[0.18] text-foreground font-semibold shadow-[0_0_16px_rgba(255,255,255,0.04)]"
                        : "hover:bg-white/[0.04] text-copy-secondary hover:text-foreground border border-transparent",
                  )}
                >
                  <span className="relative z-10 text-[13px]">{day}</span>
                  {hasTasks && (
                    <span className={cn(
                      "relative z-10 mt-0.5 h-1 w-1 rounded-full transition-colors",
                      isSelected || isToday ? "bg-white/70" : "bg-white/25 group-hover:bg-white/40",
                    )} />
                  )}
                  {taskCount > 1 && (
                    <span className={cn(
                      "absolute top-1 right-1 text-[9px] font-medium leading-none",
                      isSelected || isToday ? "text-white/60" : "text-white/20",
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

      {/* ── Fullscreen task experience ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            key="fullscreen-tasks"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute inset-0 z-30 bg-background flex flex-col overflow-hidden"
          >
            {/* Subtle top gradient */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.015] to-transparent pointer-events-none" />

            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 md:px-10 pt-6 pb-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-4">
                <motion.button
                  onClick={() => setSelectedDate(null)}
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 text-copy-secondary hover:text-foreground transition-colors duration-150"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Calendar</span>
                </motion.button>
                <div className="h-4 w-px bg-white/[0.1]" />
                <div>
                  <motion.h2
                    key={selectedDate}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[15px] font-semibold tracking-tight"
                  >
                    {formatDisplayDate(selectedDate)}
                  </motion.h2>
                  <p className="text-xs text-copy-muted">
                    {selectedTasks.length === 0
                      ? "No tasks"
                      : `${selectedTasks.filter((t) => !t.completed).length} of ${selectedTasks.length} remaining`}
                  </p>
                </div>
              </div>
              <motion.button
                onClick={() => { setEditingTask(null); setModalOpen(true); }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.07] border border-white/[0.1] hover:bg-white/[0.1] hover:border-white/[0.15] text-sm font-medium transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </motion.button>
            </div>

            {/* Task list */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-10 py-6">
              <AnimatePresence initial={false} mode="popLayout">
                {selectedTasks.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex flex-col items-center justify-center py-24 text-center"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] grid place-items-center mb-5">
                      <CalendarDays className="h-6 w-6 text-white/20" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-copy-secondary">No tasks for this day</p>
                    <p className="text-xs text-copy-muted mt-1.5">Click Add Task to create one</p>
                  </motion.div>
                ) : (
                  <div className="max-w-2xl mx-auto space-y-2.5">
                    {selectedTasks.map((task, i) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={i}
                        onToggle={() => toggle(task.id)}
                        onEdit={() => { setEditingTask(task); setModalOpen(true); }}
                        onDelete={() => remove(task.id)}
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>
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

// ─── Month animation variants ─────────────────────────────────────────────────

const monthVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? -20 : 20, transition: { duration: 0.18 } }),
};

const gridVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? -32 : 32, transition: { duration: 0.18 } }),
};

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.22, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      className={cn(
        "rounded-2xl border bg-white/[0.03] hover:bg-white/[0.05] overflow-hidden transition-all duration-300",
        task.completed
          ? "opacity-45 border-white/[0.05]"
          : "border-white/[0.08] hover:border-white/[0.12] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]",
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left"
      >
        {/* Checkbox */}
        <motion.button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          whileTap={{ scale: 0.85 }}
          className={cn(
            "h-5 w-5 shrink-0 rounded-md border-[1.5px] grid place-items-center transition-all duration-200",
            task.completed
              ? "bg-white/80 border-white/80"
              : "border-white/20 hover:border-white/40",
          )}
        >
          {task.completed && <Check className="h-3 w-3 text-background" strokeWidth={2.5} />}
        </motion.button>

        {/* Priority dot */}
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", p.dot)} />

        {/* Title + time */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-[13px] font-medium truncate transition-all duration-200",
            task.completed ? "line-through text-copy-muted" : "text-foreground",
          )}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="h-2.5 w-2.5 text-copy-muted" />
            <span className="text-[11px] text-copy-muted">{format12Hour(task.taskTime)}</span>
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-copy-muted shrink-0 transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/[0.05]">
              {task.description && (
                <p className="text-xs text-copy-secondary mt-3 mb-3 leading-relaxed">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.06]", p.color)}>
                  {p.label}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-copy-muted">
                  {task.notificationEnabled ? <Bell className="h-2.5 w-2.5" /> : <BellOff className="h-2.5 w-2.5" />}
                  {task.notificationEnabled ? "Reminder on" : "No reminder"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-3.5">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 text-[11px] text-copy-secondary hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-all duration-150"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 text-[11px] text-copy-secondary hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/[0.07] transition-all duration-150"
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
    const h24 =
      values.taskTimeAmpm === "PM"
        ? h === 12 ? 12 : h + 12
        : h === 12 ? 0 : h;
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
      <DialogContent className="sm:max-w-md bg-[var(--surface-1)] border border-white/[0.09] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <DialogTitle className="text-[15px] font-semibold">
            {editingTask ? "Edit task" : "New task"}
          </DialogTitle>
          <DialogDescription className="text-xs text-copy-muted mt-0.5">
            {formatDisplayDate(defaultDate)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-copy-secondary mb-1.5 block">
              Title <span className="text-white/30">*</span>
            </label>
            <input
              {...register("title")}
              placeholder="What needs to be done?"
              autoFocus
              className={cn(
                "w-full rounded-xl border bg-white/[0.04] px-3.5 py-2.5 text-sm outline-none transition-all duration-150 placeholder:text-copy-muted",
                errors.title
                  ? "border-red-400/40 focus:border-red-400/60"
                  : "border-white/[0.08] focus:border-white/[0.18] focus:bg-white/[0.06]",
              )}
            />
            {errors.title && (
              <p className="text-[11px] text-red-400/80 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Time — full 12-hour picker with all 60 minutes */}
          <div>
            <label className="text-xs font-medium text-copy-secondary mb-1.5 block">
              Time <span className="text-white/30">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Controller
                name="taskTimeHour"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="flex-1 bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15] text-sm rounded-xl">
                      <SelectValue placeholder="Hr" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-white/[0.09] max-h-48">
                      {HOURS_12.map((h) => (
                        <SelectItem key={h} value={h} className="text-sm">{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <span className="text-copy-muted text-sm font-medium shrink-0">:</span>
              <Controller
                name="taskTimeMinute"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="flex-1 bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15] text-sm rounded-xl">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-white/[0.09] max-h-48">
                      {ALL_MINUTES.map((m) => (
                        <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                name="taskTimeAmpm"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-20 bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15] text-sm rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-white/[0.09]">
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
            <label className="text-xs font-medium text-copy-secondary mb-1.5 block">
              Description <span className="text-copy-muted">(optional)</span>
            </label>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="Add details…"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm outline-none transition-all duration-150 placeholder:text-copy-muted focus:border-white/[0.18] focus:bg-white/[0.06] resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-copy-secondary mb-1.5 block">Priority</label>
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
                          "flex-1 py-2 rounded-xl border text-xs font-medium transition-all duration-150",
                          active
                            ? `border-white/[0.18] bg-white/[0.07] ${cfg.color}`
                            : "border-white/[0.07] text-copy-secondary hover:text-foreground hover:border-white/[0.12]",
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
                    ? "border-white/[0.18] bg-white/[0.05] text-foreground"
                    : "border-white/[0.07] text-copy-secondary hover:border-white/[0.12] hover:text-foreground",
                )}
              >
                {field.value ? <Bell className="h-4 w-4 shrink-0" /> : <BellOff className="h-4 w-4 shrink-0" />}
                <div className="text-left flex-1">
                  <p className="text-[13px] font-medium leading-none">
                    {field.value ? "Reminder enabled" : "Enable reminder"}
                  </p>
                  <p className="text-[11px] text-copy-muted mt-0.5">
                    {field.value ? "You'll be notified before this task" : "No notification"}
                  </p>
                </div>
                <div className={cn(
                  "h-5 w-9 rounded-full border relative shrink-0 transition-all duration-200",
                  field.value ? "bg-white/80 border-white/80" : "bg-transparent border-white/20",
                )}>
                  <span className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition-all duration-200",
                    field.value ? "left-4 bg-background" : "left-0.5 bg-white/40",
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
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm font-medium text-copy-secondary hover:text-foreground hover:border-white/[0.14] transition-all duration-150"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium disabled:opacity-40 transition-opacity hover:opacity-90"
            >
              {submitting ? "Saving…" : editingTask ? "Save changes" : "Add task"}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
