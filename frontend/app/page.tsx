"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { useProjects } from "@/lib/api";

export default function HomePage() {
  const { status } = useSession();
  const { data: projects, isLoading, error } = useProjects();

  if (status === "unauthenticated") {
    return <p className="text-slate-600">Sign in to see your projects.</p>;
  }
  if (status === "loading" || isLoading) {
    return <p className="text-slate-500">Loading…</p>;
  }
  if (error) {
    return <p className="text-red-600">Failed to load projects.</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Your projects</h1>
      {projects && projects.length === 0 ? (
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
    </div>
  );
}
