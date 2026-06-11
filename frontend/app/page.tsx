"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";

import {
  useCreateOrg,
  useCreateProject,
  useOrgs,
  useProjects,
} from "@/lib/api";

export default function HomePage() {
  const { status } = useSession();
  const { data: projects, isLoading } = useProjects();
  const { data: orgs } = useOrgs();
  const createOrg = useCreateOrg();
  const createProject = useCreateProject();

  const [orgName, setOrgName] = useState("");
  const [projName, setProjName] = useState("");
  const [orgId, setOrgId] = useState("");

  if (status === "unauthenticated") {
    return <p className="text-slate-600">Sign in to see your projects.</p>;
  }
  if (status === "loading") {
    return <p className="text-slate-500">Loading…</p>;
  }

  // Orgs the user can create projects in (admins only).
  const adminOrgs = (orgs ?? []).filter((o) => o.my_role === "admin");
  const effectiveOrgId = orgId || adminOrgs[0]?.id || "";

  return (
    <div className="space-y-8">
      {/* --- create controls -------------------------------------------- */}
      <section className="grid gap-4 md:grid-cols-2">
        <form
          className="rounded-lg border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!orgName.trim()) return;
            createOrg.mutate(orgName, { onSuccess: () => setOrgName("") });
          }}
        >
          <h2 className="mb-2 font-semibold">New organization</h2>
          <p className="mb-3 text-xs text-slate-500">
            You become its admin and can create projects in it.
          </p>
          <div className="flex gap-2">
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Org name (e.g. Acme)"
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-900">
              Create
            </button>
          </div>
        </form>

        <form
          className="rounded-lg border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!projName.trim() || !effectiveOrgId) return;
            createProject.mutate(
              { org_id: effectiveOrgId, name: projName },
              { onSuccess: () => setProjName("") },
            );
          }}
        >
          <h2 className="mb-2 font-semibold">New project</h2>
          {adminOrgs.length === 0 ? (
            <p className="text-xs text-slate-500">
              Create an organization first — only org admins can add projects.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <select
                value={effectiveOrgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
              >
                {adminOrgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="Project name (e.g. Website)"
                  className="flex-1 rounded border px-3 py-2 text-sm"
                />
                <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                  Create
                </button>
              </div>
            </div>
          )}
        </form>
      </section>

      {/* --- project list ----------------------------------------------- */}
      <section>
        <h1 className="mb-4 text-2xl font-bold">Your projects</h1>
        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : projects && projects.length === 0 ? (
          <p className="text-slate-500">
            No projects yet. Projects you own or can view (via your org) appear here.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects?.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded-lg border bg-white p-4 shadow-sm hover:shadow"
                >
                  <div className="font-semibold">{p.name}</div>
                  {p.description && (
                    <div className="mt-1 text-sm text-slate-500">{p.description}</div>
                  )}
                  <div className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                    {p.my_role ?? "viewer (via org)"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
