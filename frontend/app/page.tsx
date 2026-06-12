"use client";

import { ArrowRight, Crown, FolderKanban, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { LoaderScreen } from "@/components/Loader";
import { toast } from "sonner";

import { Select } from "@/components/Select";
import { useCreateProject, useOrgs, useProjects } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

const ROLE_STYLES: Record<string, { badge: string; bar: string }> = {
  owner: { badge: "bg-indigo-50 text-indigo-700", bar: "bg-indigo-500" },
  editor: { badge: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  viewer: { badge: "bg-slate-100 text-slate-600", bar: "bg-slate-300" },
};

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur">
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-xs text-indigo-100">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const { data: projects, isLoading } = useProjects();
  const { data: orgs } = useOrgs();
  const createProject = useCreateProject();

  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [query, setQuery] = useState("");

  const adminOrgs = (orgs ?? []).filter((o) => o.my_role === "admin");
  const effectiveOrgId = orgId || adminOrgs[0]?.id || "";

  const stats = useMemo(() => {
    const list = projects ?? [];
    return {
      total: list.length,
      owned: list.filter((p) => p.my_role === "owner").length,
      shared: list.filter((p) => p.my_role !== "owner").length,
    };
  }, [projects]);

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  if (isLoading) return <LoaderScreen message="Loading projects" />;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="mt-1 max-w-md text-sm text-indigo-100">
              Boards you own or can see through your organizations. Access is
              resolved live by OpenFGA.
            </p>
          </div>
          <div className="flex gap-3">
            <StatChip label="Total" value={stats.total} />
            <StatChip label="Owned" value={stats.owned} />
            <StatChip label="Shared" value={stats.shared} />
          </div>
        </div>
      </div>

      {/* Create + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {adminOrgs.length === 0 ? (
          <p className="text-sm text-slate-500">
            You need to be an admin of an organization to add projects. Tenants
            are provisioned from the{" "}
            <Link href="/tenants" className="text-indigo-600 hover:underline">
              Tenants
            </Link>{" "}
            page (platform admins).
          </p>
        ) : (
          <form
            className="flex w-full gap-2 sm:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !effectiveOrgId) return;
              createProject.mutate(
                { org_id: effectiveOrgId, name },
                {
                  onSuccess: () => {
                    setName("");
                    toast.success("Project created");
                  },
                },
              );
            }}
          >
            <Select
              value={effectiveOrgId}
              onChange={setOrgId}
              options={adminOrgs.map((o) => ({ value: o.id, label: o.name }))}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New project…"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:w-40"
            />
            <button
              disabled={createProject.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </form>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            {query
              ? "No projects match your search."
              : "No projects yet. Create one above to get started."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const role = p.my_role ?? "viewer";
            const style = ROLE_STYLES[role] ?? ROLE_STYLES.viewer;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  <div className={`h-1.5 w-full ${style.bar}`} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <FolderKanban className="h-5 w-5" />
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
                      >
                        {role === "owner" && <Crown className="h-3 w-3" />}
                        {roleLabel(role)}
                      </span>
                    </div>
                    <div className="mt-3 font-semibold text-slate-900 group-hover:text-indigo-700">
                      {p.name}
                    </div>
                    {p.description && (
                      <div className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {p.description}
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-slate-400">
                      <span>
                        {new Date(p.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
                        Open board <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
