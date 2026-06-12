"use client";

import { Check, ChevronsUpDown, FolderKanban, Settings } from "lucide-react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { useState } from "react";

import { useProjects } from "@/lib/api";

export function ProjectSwitcher() {
  const { data: projects } = useProjects();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [open, setOpen] = useState(false);

  // Only relevant on project routes; show a switcher everywhere once you have projects.
  const currentId = pathname.startsWith("/projects/") ? (params.id as string) : null;
  const current = projects?.find((p) => p.id === currentId);

  if (!projects || projects.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
      >
        <FolderKanban className="h-4 w-4 text-indigo-500" />
        <span className="max-w-[160px] truncate font-medium">
          {current ? current.name : "Select project"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border bg-white shadow-lg">
            <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Your projects
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {projects.map((p) => {
                const isCurrent = p.id === currentId;
                return (
                  <li key={p.id} className="flex items-center">
                    <button
                      onClick={() => {
                        setOpen(false);
                        router.push(`/projects/${p.id}`);
                      }}
                      className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {isCurrent ? (
                        <Check className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <span className="h-4 w-4" />
                      )}
                      <span className="flex-1 truncate text-slate-700">{p.name}</span>
                      {p.key && (
                        <span className="font-mono text-[11px] text-slate-400">{p.key}</span>
                      )}
                      {isCurrent && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                          current
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        router.push(`/projects/${p.id}/settings`);
                      }}
                      title="Project settings"
                      className="mr-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
