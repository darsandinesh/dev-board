"use client";

import { LoaderScreen } from "@/components/Loader";
import { useReport } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-amber-400",
  done: "bg-emerald-500",
};
const GENERIC = "bg-indigo-500";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function BarList({
  title,
  data,
  total,
  colorFor,
}: {
  title: string;
  data: Record<string, number>;
  total: number;
  colorFor?: (k: string) => string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No data.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([k, v]) => (
            <li key={k}>
              <div className="mb-0.5 flex justify-between text-xs text-slate-500">
                <span className="capitalize">{k.replace("_", " ")}</span>
                <span>{v}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${colorFor ? colorFor(k) : GENERIC}`}
                  style={{ width: `${total ? (v / total) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Reports({ projectId }: { projectId: string }) {
  const { data: r, isLoading } = useReport(projectId);
  if (isLoading || !r) return <LoaderScreen message="Loading report" />;

  const donePct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  const ptsPct = r.points_total ? Math.round((r.points_done / r.points_total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total issues" value={r.total} />
        <Stat label="Done" value={`${r.done}`} sub={`${donePct}% complete`} />
        <Stat label="Story points" value={r.points_total} sub={`${r.points_done} done`} />
        <Stat label="Points progress" value={`${ptsPct}%`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BarList title="By status" data={r.by_status} total={r.total} colorFor={(k) => STATUS_COLOR[k] ?? GENERIC} />
        <BarList title="By type" data={r.by_type} total={r.total} />
        <BarList title="By priority" data={r.by_priority} total={r.total} />
      </div>

      <BarList title="Workload by assignee" data={r.by_assignee} total={r.total} />

      {r.active_sprints.length > 0 && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Active sprints</h3>
          <ul className="space-y-3">
            {r.active_sprints.map((s) => {
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
              return (
                <li key={s.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{s.name}</span>
                    <span className="text-slate-400">
                      {s.done}/{s.total} done · {s.points_done}/{s.points} pts
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
