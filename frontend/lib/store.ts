"use client";

import { create } from "zustand";

import type { TaskStatus } from "./api";

interface DragState {
  draggingId: string | null;
  setDragging: (id: string | null) => void;
  // the column currently hovered, used to compute the drop target status
  hoverColumn: TaskStatus | null;
  setHoverColumn: (s: TaskStatus | null) => void;
}

export const useDragStore = create<DragState>((set) => ({
  draggingId: null,
  setDragging: (id) => set({ draggingId: id }),
  hoverColumn: null,
  setHoverColumn: (s) => set({ hoverColumn: s }),
}));
