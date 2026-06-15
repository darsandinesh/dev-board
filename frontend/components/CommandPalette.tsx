"use client";

import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  Search,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useMe, useProjects } from "@/lib/api";
import { cn } from "@/lib/cn";

type Item = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
};

/** ⌘K / Ctrl+K palette: jump to any project or app page from anywhere. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { data: projects } = useProjects();
  const { data: me } = useMe();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = [
      {
        id: "nav-home",
        label: "Projects",
        hint: "Page",
        icon: LayoutDashboard,
        run: () => go("/"),
      },
      { id: "nav-members", label: "Members", hint: "Page", icon: Users, run: () => go("/members") },
      { id: "nav-profile", label: "Profile", hint: "Page", icon: User, run: () => go("/profile") },
      {
        id: "nav-settings",
        label: "Settings",
        hint: "Page",
        icon: Settings,
        run: () => go("/settings"),
      },
    ];
    if (me?.is_platform_admin) {
      nav.splice(1, 0, {
        id: "nav-tenants",
        label: "Tenants",
        hint: "Page",
        icon: Building2,
        run: () => go("/tenants"),
      });
    }
    const projectItems: Item[] = (projects ?? []).map((p) => ({
      id: `proj-${p.id}`,
      label: p.name,
      hint: "Project",
      icon: FolderKanban,
      run: () => go(`/projects/${p.id}`),
    }));
    const all = [...projectItems, ...nav];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, me, query]);

  // Reset selection whenever the result set changes; focus input on open.
  useEffect(() => setActive(0), [query, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and pages…"
            className="w-full bg-transparent py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <kbd className="rounded border bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
            esc
          </kbd>
        </div>

        <ul className="max-h-80 overflow-auto p-2">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No matches.
            </li>
          )}
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <li key={it.id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={it.run}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                    i === active
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-700 dark:text-slate-200",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate">{it.label}</span>
                  <span className="text-[11px] text-slate-400">{it.hint}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 border-t bg-slate-50 px-4 py-2 text-[11px] text-slate-400 dark:bg-slate-800/50">
          <span>
            <kbd className="rounded border bg-white px-1">↑</kbd>{" "}
            <kbd className="rounded border bg-white px-1">↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded border bg-white px-1">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded border bg-white px-1">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
