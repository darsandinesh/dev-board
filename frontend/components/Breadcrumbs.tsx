"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useProject, useTasks } from "@/lib/api";

const PAGE_LABELS: Record<string, string> = {
  members: "Members",
  profile: "Profile",
  settings: "Settings",
  tenants: "Tenants",
};

type Crumb = { label: string; href?: string };

/** Route-derived breadcrumb trail shown in the header ("where am I"). */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // projectId is segments[1] on any /projects/<id>/... route.
  const projectId = segments[0] === "projects" ? segments[1] : undefined;
  const taskId = segments[0] === "projects" && segments[2] === "issues" ? segments[3] : undefined;

  const { data: project } = useProject(projectId ?? "");
  const { data: tasks } = useTasks(taskId ? (projectId ?? "") : "");
  const task = taskId ? tasks?.find((t) => t.id === taskId) : undefined;

  const crumbs: Crumb[] = [{ label: "Projects", href: "/" }];

  if (segments[0] === "projects" && projectId) {
    crumbs.push({ label: project?.name ?? "Project", href: `/projects/${projectId}` });
    if (segments[2] === "settings") crumbs.push({ label: "Settings" });
    if (taskId) {
      const key = project?.key && task?.seq != null ? `${project.key}-${task.seq}` : "Issue";
      crumbs.push({ label: key });
    }
  } else if (segments[0] && PAGE_LABELS[segments[0]]) {
    crumbs.push({ label: PAGE_LABELS[segments[0]] });
  }

  return (
    <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
            {c.href && !last ? (
              <Link href={c.href} className="truncate text-slate-500 hover:text-slate-800">
                {c.label}
              </Link>
            ) : (
              <span
                className={last ? "truncate font-medium text-slate-800" : "truncate text-slate-500"}
              >
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
