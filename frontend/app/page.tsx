"use client";

import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useCreateProject, useOrgs, useProjects } from "@/lib/api";

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-indigo-50 text-indigo-700",
  editor: "bg-emerald-50 text-emerald-700",
  viewer: "bg-slate-100 text-slate-600",
};

export default function HomePage() {
  const { data: projects, isLoading } = useProjects();
  const { data: orgs } = useOrgs();
  const createProject = useCreateProject();

  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");

  const adminOrgs = (orgs ?? []).filter((o) => o.my_role === "admin");
  const effectiveOrgId = orgId || adminOrgs[0]?.id || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
      </div>

      {/* Create project */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Plus className="h-4 w-4 text-indigo-600" /> New project
        </h2>
        {adminOrgs.length === 0 ? (
          <p className="text-sm text-slate-500">
            You need to be an admin of an organization first.{" "}
            <Link href="/settings" className="text-indigo-600 hover:underline">
              Create one in Settings
            </Link>
            .
          </p>
        ) : (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !effectiveOrgId) return;
              createProject.mutate(
                { org_id: effectiveOrgId, name },
                { onSuccess: () => setName("") },
              );
            }}
          >
            <select
              value={effectiveOrgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {adminOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name (e.g. Website)"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              disabled={createProject.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              Create
            </button>
          </form>
        )}
      </section>

      {/* Project grid */}
      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : projects && projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            No projects yet. Create one above, or projects shared with you (via your
            org) will appear here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="group flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <FolderKanban className="h-6 w-6 text-indigo-500" />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      ROLE_STYLES[p.my_role ?? ""] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.my_role ?? "viewer"}
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
