import {
  Bug,
  BookOpen,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Equal,
  SquareCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { LinkType, TaskPriority, TaskType } from "@/lib/api";

export const TYPE_META: Record<TaskType, { icon: LucideIcon; color: string; label: string }> = {
  epic: { icon: Zap, color: "text-violet-600", label: "Epic" },
  task: { icon: SquareCheck, color: "text-sky-600", label: "Task" },
  story: { icon: BookOpen, color: "text-emerald-600", label: "Story" },
  bug: { icon: Bug, color: "text-red-600", label: "Bug" },
};

export const LINK_LABELS: Record<LinkType, string> = {
  blocks: "blocks",
  blocked_by: "is blocked by",
  relates_to: "relates to",
  duplicates: "duplicates",
};

export const PRIORITY_META: Record<
  TaskPriority,
  { icon: LucideIcon; color: string; label: string }
> = {
  low: { icon: ChevronDown, color: "text-slate-400", label: "Low" },
  medium: { icon: Equal, color: "text-amber-500", label: "Medium" },
  high: { icon: ChevronUp, color: "text-orange-500", label: "High" },
  urgent: { icon: ChevronsUp, color: "text-red-600", label: "Urgent" },
};

export const TYPES: TaskType[] = ["epic", "task", "story", "bug"];
export const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
export const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
] as const;
