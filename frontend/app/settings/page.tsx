"use client";

import { Building2, LogOut, Plus, UserCircle } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { useCreateOrg, useMe, useOrgs } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

export default function SettingsPage() {
  const { data: me } = useMe();
  const { data: orgs } = useOrgs();
  const createOrg = useCreateOrg();
  const [orgName, setOrgName] = useState("");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Account */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <UserCircle className="h-5 w-5 text-indigo-600" /> Account
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between sm:block">
            <dt className="text-slate-400">Username</dt>
            <dd className="font-medium text-slate-700">{me?.username ?? "—"}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-slate-400">Email</dt>
            <dd className="font-medium text-slate-700">{me?.email ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          Identity is managed by Keycloak. To change your name or password, update
          it in the Keycloak account console.
        </p>
      </section>

      {/* Organizations */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Building2 className="h-5 w-5 text-indigo-600" /> Organizations
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {me?.is_platform_admin
            ? "As a platform admin, you can provision new tenants."
            : "Tenants are provisioned by a platform admin. You manage the orgs you belong to."}
        </p>

        {me?.is_platform_admin && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!orgName.trim()) return;
              createOrg.mutate(orgName, { onSuccess: () => setOrgName("") });
            }}
          >
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="New tenant / organization name"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              disabled={createOrg.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </form>
        )}

        {orgs && orgs.length > 0 && (
          <ul className="mt-4 divide-y">
            {orgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium text-slate-700">{o.name}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    o.my_role === "admin"
                      ? "bg-indigo-50 text-indigo-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {roleLabel(o.my_role)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Session */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Session</h2>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>
    </div>
  );
}
