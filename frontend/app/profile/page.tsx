"use client";

import { Building2, Mail, ShieldCheck } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { useMe, useOrgs } from "@/lib/api";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 break-all font-mono text-sm text-slate-700">{value}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const { data: orgs } = useOrgs();

  if (isLoading || !me) return <p className="text-slate-500">Loading…</p>;

  const fullName = [me.given_name, me.family_name].filter(Boolean).join(" ") || me.username;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name={fullName} size={64} />
          <div>
            <div className="text-xl font-semibold text-slate-900">{fullName}</div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-4 w-4" /> {me.email}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2">
          <Field label="Username" value={me.username} />
          <Field label="Local user id" value={me.id} />
          <Field label="Keycloak subject (sub)" value={me.sub} />
        </dl>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Building2 className="h-5 w-5 text-indigo-600" /> Organizations
        </h2>
        {orgs && orgs.length > 0 ? (
          <ul className="mt-4 divide-y">
            {orgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium text-slate-700">{o.name}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    o.my_role === "admin"
                      ? "bg-indigo-50 text-indigo-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {o.my_role === "admin" && <ShieldCheck className="h-3 w-3" />}
                  {o.my_role}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            You’re not a member of any organization yet.
          </p>
        )}
      </section>
    </div>
  );
}
