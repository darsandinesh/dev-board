"use client";

import { ArrowRight, Crown, FolderKanban, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { toast } from "sonner";

import { GettingStarted } from "@/components/GettingStarted";
import { Select } from "@/components/Select";
import { Badge, ROLE_TONE } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { useCreateProject, useMe, useOrgs, useProjects } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

const ROLE_BAR: Record<string, string> = {
  owner: "bg-indigo-500",
  editor: "bg-emerald-500",
  viewer: "bg-slate-300",
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
  const { data: me } = useMe();
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
  const noProjects = !isLoading && (projects ?? []).length === 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="mt-1 max-w-md text-sm text-indigo-100">
              Boards you own or can see through your organizations. Access is resolved live by
              OpenFGA.
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
          <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="pl-9"
          />
        </div>

        {adminOrgs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You need to be an admin of an organization to add projects. Tenants are provisioned from
            the{" "}
            <Link href="/tenants" className="text-indigo-600 hover:underline dark:text-indigo-400">
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New project…"
              className="flex-1 sm:w-40"
            />
            <Button disabled={createProject.isPending}>
              <Plus className="h-4 w-4" /> Create
            </Button>
          </form>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <CardGridSkeleton />
      ) : noProjects ? (
        <GettingStarted
          isPlatformAdmin={!!me?.is_platform_admin}
          hasAdminOrg={adminOrgs.length > 0}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderKanban}>No projects match your search.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const role = p.my_role ?? "viewer";
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:bg-slate-900 dark:hover:border-indigo-500"
                >
                  <div className={`h-1.5 w-full ${ROLE_BAR[role] ?? ROLE_BAR.viewer}`} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        <FolderKanban className="h-5 w-5" />
                      </span>
                      <Badge tone={ROLE_TONE[role] ?? "slate"}>
                        {role === "owner" && <Crown className="h-3 w-3" />}
                        {roleLabel(role)}
                      </Badge>
                    </div>
                    <div className="mt-3 font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-400">
                      {p.name}
                    </div>
                    {p.description && (
                      <div className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
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
