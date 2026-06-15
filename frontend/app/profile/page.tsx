"use client";

import { Building2, FolderKanban, Mail, ShieldCheck, Sparkles } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { LoaderScreen } from "@/components/Loader";
import { useMe, useOrgs, useProjects } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={`mt-0.5 break-all text-sm text-slate-700 dark:text-slate-200 ${mono ? "font-mono" : ""}`}
      >
        {value || <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}

function RoleChip({ role }: { role: string }) {
  const admin = role === "admin" || role === "owner";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        admin ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {admin && <ShieldCheck className="h-3 w-3" />}
      {roleLabel(role)}
    </span>
  );
}

export default function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const { data: orgs } = useOrgs();
  const { data: projects } = useProjects();

  if (isLoading || !me) return <LoaderScreen message="Loading profile" />;

  const fullName = [me.given_name, me.family_name].filter(Boolean).join(" ") || me.username;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Profile</h1>

      {/* Identity header */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <Avatar name={fullName} size={64} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {fullName}
              </span>
              {me.is_platform_admin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <Sparkles className="h-3 w-3" /> Platform Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-4 w-4" /> {me.email}
            </div>
          </div>
        </div>

        {/* Account details */}
        <dl className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2">
          <Field label="First name" value={me.given_name} />
          <Field label="Last name" value={me.family_name} />
          <Field label="Username" value={me.username} />
          <Field label="Email" value={me.email} />
          <Field label="Platform admin" value={me.is_platform_admin ? "Yes" : "No"} />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Realm roles
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {me.roles.length ? (
                me.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                  >
                    {r}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-300">—</span>
              )}
            </dd>
          </div>
          <Field label="Local user id" value={me.id} mono />
          <Field label="Keycloak subject (sub)" value={me.sub} mono />
        </dl>
      </section>

      {/* Organizations */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <Building2 className="h-5 w-5 text-indigo-600" /> Organizations
          <span className="ml-1 rounded-full bg-slate-100 px-2 text-xs text-slate-500">
            {orgs?.length ?? 0}
          </span>
        </h2>
        {orgs && orgs.length > 0 ? (
          <ul className="mt-4 divide-y">
            {orgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium text-slate-700 dark:text-slate-200">{o.name}</span>
                <RoleChip role={o.my_role} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            You’re not a member of any organization yet.
          </p>
        )}
      </section>

      {/* Projects */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <FolderKanban className="h-5 w-5 text-indigo-600" /> Projects
          <span className="ml-1 rounded-full bg-slate-100 px-2 text-xs text-slate-500">
            {projects?.length ?? 0}
          </span>
        </h2>
        {projects && projects.length > 0 ? (
          <ul className="mt-4 divide-y">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <a
                  href={`/projects/${p.id}`}
                  className="font-medium text-slate-700 hover:text-indigo-700 dark:text-slate-200 dark:hover:text-indigo-400"
                >
                  {p.name}
                </a>
                <RoleChip role={p.my_role ?? "viewer"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">You’re not a member of any project yet.</p>
        )}
      </section>
    </div>
  );
}
