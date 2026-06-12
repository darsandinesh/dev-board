"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { TaskStatus } from "./api";

interface DragState {
  draggingId: string | null;
  setDragging: (id: string | null) => void;
  hoverColumn: TaskStatus | null;
  setHoverColumn: (s: TaskStatus | null) => void;
  // the task open in the detail modal (null = closed)
  selectedTaskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
}

export const useDragStore = create<DragState>((set) => ({
  draggingId: null,
  setDragging: (id) => set({ draggingId: id }),
  hoverColumn: null,
  setHoverColumn: (s) => set({ hoverColumn: s }),
  selectedTaskId: null,
  openTask: (id) => set({ selectedTaskId: id }),
  closeTask: () => set({ selectedTaskId: null }),
}));

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

// Persisted so the collapse preference survives reloads.
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    { name: "devboard-ui" },
  ),
);
