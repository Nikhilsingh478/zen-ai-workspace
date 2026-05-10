import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  X,
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
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Task form schema ─────────────────────────────────────────────────────────

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  taskTimeHour: z.string().min(1, "Hour required"),
  taskTimeMinute: z.string().min(1, "Minute required"),
  taskTimeAmpm: z.enum(["AM", "PM"]),
  priority: z.enum(["low", "medium", "high"]),
  notificationEnabled: z.boolean(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

// ─── Main page ───────────────────────────────────────────────────────────────

function HorizonPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(today));
  const [panelOpen, setPanelOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<HorizonTask | null>(null);

  const { tasksForDate, datesWithTasks, add, update, toggle, remove } = useHorizon();
  const selectedTasks = tasksForDate(selectedDate);

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
    const key = formatDateKey(today);
    setSelectedDate(key);
    setPanelOpen(true);
  }, [today]);

  const selectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setPanelOpen(true);
  };

  const openAdd = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const openEdit = (task: HorizonTask) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  // Calendar grid computation
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const todayKey = formatDateKey(today);

  // Build grid cells: previous month overflow + current month + next month overflow
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 md:px-8 pt-6 pb-4 flex items-center gap-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex items-center gap-3"
        >
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-violet-500/5 border border-violet-500/20 grid place-items-center">
            <CalendarDays className="h-4 w-4 text-violet-400" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight leading-none">Horizon</h1>
            <p className="text-[11px] text-copy-muted mt-0.5">Calendar & tasks</p>
          </div>
        </motion.div>
      </div>

      {/* Body: calendar + panel */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Calendar column */}
        <div className="flex-1 min-w-0 overflow-y-auto px-4 md:px-8 pb-6">
          {/* Month nav */}
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
                className="hidden sm:flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-copy-secondary border border-border/50 hover:border-border hover:text-foreground transition-all duration-200"
              >
                Today
              </button>
              <button
                onClick={prevMonth}
                className="h-8 w-8 rounded-lg border border-border/50 hover:border-border grid place-items-center text-copy-secondary hover:text-foreground transition-all duration-200"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={nextMonth}
                className="h-8 w-8 rounded-lg border border-border/50 hover:border-border grid place-items-center text-copy-secondary hover:text-foreground transition-all duration-200"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>

          {/* Day labels */}
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

                return (
                  <motion.button
                    key={dateStr}
                    onClick={() => selectDate(dateStr)}
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={cn(
                      "relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors duration-150 group",
                      !currentMonth && "opacity-25",
                      isSelected && !isToday
                        ? "bg-white/[0.08] border border-white/10 text-foreground"
                        : isToday
                          ? "bg-violet-500/15 border border-violet-500/30 text-violet-300"
                          : "hover:bg-white/[0.05] text-copy-secondary hover:text-foreground border border-transparent",
                    )}
                  >
                    {isToday && (
                      <motion.span
                        layoutId="today-glow"
                        className="absolute inset-0 rounded-xl bg-violet-500/10 blur-sm"
                      />
                    )}
                    <span className={cn("relative z-10 text-[13px]", isToday && "text-violet-300 font-semibold")}>
                      {day}
                    </span>
                    {hasTasks && (
                      <span
                        className={cn(
                          "relative z-10 mt-0.5 h-1 w-1 rounded-full",
                          isSelected || isToday ? "bg-violet-400" : "bg-copy-muted group-hover:bg-copy-secondary",
                        )}
                      />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Task panel — desktop: right side; mobile: bottom overlay */}
        <>
          {/* Desktop panel */}
          <AnimatePresence>
            {panelOpen && (
              <motion.aside
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="hidden md:flex flex-col w-80 shrink-0 border-l border-border bg-[var(--surface-1)] overflow-hidden"
              >
                <TaskPanel
                  dateStr={selectedDate}
                  tasks={selectedTasks}
                  onAdd={openAdd}
                  onEdit={openEdit}
                  onToggle={toggle}
                  onDelete={remove}
                  onClose={() => setPanelOpen(false)}
                />
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Mobile bottom sheet */}
          <AnimatePresence>
            {panelOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                  onClick={() => setPanelOpen(false)}
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 32 }}
                  className="md:hidden fixed bottom-0 inset-x-0 z-50 rounded-t-2xl border-t border-border bg-[var(--surface-1)] max-h-[80dvh] flex flex-col"
                >
                  <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-1 shrink-0" />
                  <TaskPanel
                    dateStr={selectedDate}
                    tasks={selectedTasks}
                    onAdd={openAdd}
                    onEdit={openEdit}
                    onToggle={toggle}
                    onDelete={remove}
                    onClose={() => setPanelOpen(false)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      </div>

      {/* Task modal */}
      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        defaultDate={selectedDate}
        editingTask={editingTask}
        onSubmit={async (input) => {
          if (editingTask) {
            const ok = await update(editingTask.id, input);
            if (ok) { setModalOpen(false); setEditingTask(null); }
          } else {
            const ok = await add(input);
            if (ok) { setModalOpen(false); }
          }
        }}
      />
    </div>
  );
}

// ─── Month animation variants ─────────────────────────────────────────────────

const monthVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? -20 : 20, transition: { duration: 0.2 } }),
};

const gridVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir === 0 ? 0 : dir > 0 ? -32 : 32, transition: { duration: 0.2 } }),
};

// ─── Task panel ───────────────────────────────────────────────────────────────

function TaskPanel({
  dateStr,
  tasks,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  onClose,
}: {
  dateStr: string;
  tasks: HorizonTask[];
  onAdd: () => void;
  onEdit: (t: HorizonTask) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const incomplete = tasks.filter((t) => !t.completed).length;

  return (
    <>
      {/* Panel header */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <motion.h3
            key={dateStr}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="text-[15px] font-semibold tracking-tight"
          >
            {formatDisplayDate(dateStr)}
          </motion.h3>
          <motion.p
            key={dateStr + "-count"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-copy-muted mt-0.5"
          >
            {tasks.length === 0
              ? "No tasks"
              : `${incomplete} of ${tasks.length} remaining`}
          </motion.p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            onClick={onAdd}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </motion.button>
          <button
            onClick={onClose}
            className="h-7 w-7 grid place-items-center rounded-lg text-copy-muted hover:text-foreground hover:bg-white/[0.06] transition-colors"
            aria-label="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        <AnimatePresence initial={false}>
          {tasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-border grid place-items-center mb-3">
                <CalendarDays className="h-4 w-4 text-copy-muted" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-copy-secondary">No tasks yet</p>
              <p className="text-xs text-copy-muted mt-1">Click Add to create one</p>
            </motion.div>
          ) : (
            tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                onToggle={() => onToggle(task.id)}
                onEdit={() => onEdit(task)}
                onDelete={() => onDelete(task.id)}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.22, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      layout
      className={cn(
        "rounded-xl border border-border/60 bg-[var(--surface-2)] overflow-hidden transition-opacity duration-300",
        task.completed && "opacity-50",
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
      >
        {/* Checkbox */}
        <motion.button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          whileTap={{ scale: 0.88 }}
          className={cn(
            "h-5 w-5 shrink-0 rounded-md border-[1.5px] grid place-items-center transition-all duration-200",
            task.completed
              ? "bg-foreground border-foreground"
              : "border-border/60 hover:border-copy-secondary",
          )}
        >
          {task.completed && <Check className="h-3 w-3 text-background" strokeWidth={2.5} />}
        </motion.button>

        {/* Priority dot */}
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", p.dot)} />

        {/* Title + time */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-[13px] font-medium truncate", task.completed && "line-through text-copy-secondary")}>
            {task.title}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
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
            <div className="px-3.5 pb-3.5 pt-0 border-t border-border/40">
              {task.description && (
                <p className="text-xs text-copy-secondary mt-3 mb-3 leading-relaxed">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.05]", p.color)}>
                  {p.label}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-copy-muted">
                  {task.notificationEnabled ? (
                    <Bell className="h-2.5 w-2.5" />
                  ) : (
                    <BellOff className="h-2.5 w-2.5" />
                  )}
                  {task.notificationEnabled ? "Reminder on" : "No reminder"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 text-[11px] text-copy-secondary hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-all duration-150"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 text-[11px] text-red-400/70 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/[0.08] transition-all duration-150"
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
    const h24 = values.taskTimeAmpm === "PM"
      ? (h === 12 ? 12 : h + 12)
      : (h === 12 ? 0 : h);
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
      <DialogContent className="sm:max-w-md bg-[var(--surface-1)] border-border gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-[15px] font-semibold">
            {editingTask ? "Edit task" : "New task"}
          </DialogTitle>
          <p className="text-xs text-copy-muted mt-0.5">
            {formatDisplayDate(defaultDate)}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-copy-secondary mb-1.5 block">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              {...register("title")}
              placeholder="What needs to be done?"
              className={cn(
                "w-full rounded-lg border bg-[var(--surface-2)] px-3.5 py-2.5 text-sm outline-none transition-colors duration-150 placeholder:text-copy-muted",
                errors.title
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-border/60 focus:border-white/20",
              )}
            />
            {errors.title && (
              <p className="text-[11px] text-red-400 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Time — 12-hour picker */}
          <div>
            <label className="text-xs font-medium text-copy-secondary mb-1.5 block">
              Time <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Controller
                name="taskTimeHour"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="flex-1 bg-[var(--surface-2)] border-border/60 text-sm">
                      <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-border">
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={h} className="text-sm">{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <span className="text-copy-muted text-sm font-medium">:</span>
              <Controller
                name="taskTimeMinute"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="flex-1 bg-[var(--surface-2)] border-border/60 text-sm">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-border">
                      {MINUTES.map((m) => (
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
                    <SelectTrigger className="w-20 bg-[var(--surface-2)] border-border/60 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-2)] border-border">
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
              className="w-full rounded-lg border border-border/60 bg-[var(--surface-2)] px-3.5 py-2.5 text-sm outline-none transition-colors duration-150 placeholder:text-copy-muted focus:border-white/20 resize-none"
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
                          "flex-1 py-2 rounded-lg border text-xs font-medium transition-all duration-150",
                          active
                            ? `border-current bg-white/[0.06] ${cfg.color}`
                            : "border-border/50 text-copy-secondary hover:text-foreground hover:border-border",
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
                  "w-full flex items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-all duration-150",
                  field.value
                    ? "border-violet-500/30 bg-violet-500/[0.05] text-violet-300"
                    : "border-border/50 text-copy-secondary hover:border-border hover:text-foreground",
                )}
              >
                {field.value ? (
                  <Bell className="h-4 w-4 shrink-0" />
                ) : (
                  <BellOff className="h-4 w-4 shrink-0" />
                )}
                <div className="text-left flex-1">
                  <p className="text-[13px] font-medium leading-none">
                    {field.value ? "Reminder enabled" : "Enable reminder"}
                  </p>
                  <p className="text-[11px] text-copy-muted mt-0.5">
                    {field.value ? "You'll be notified before this task" : "No notification"}
                  </p>
                </div>
                <div
                  className={cn(
                    "h-5 w-9 rounded-full border transition-all duration-200 relative shrink-0",
                    field.value ? "bg-violet-500 border-violet-500" : "bg-transparent border-border",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 shadow-sm",
                      field.value ? "left-4" : "left-0.5",
                    )}
                  />
                </div>
              </button>
            )}
          />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-border/60 text-sm font-medium text-copy-secondary hover:text-foreground hover:border-border transition-all duration-150"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              className="flex-1 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
            >
              {submitting ? "Saving…" : editingTask ? "Save changes" : "Add task"}
            </motion.button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
