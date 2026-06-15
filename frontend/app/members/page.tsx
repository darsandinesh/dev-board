"use client";

import { Building2, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AddMemberSearch } from "@/components/AddMemberSearch";
import { Avatar } from "@/components/Avatar";
import { Loader, LoaderScreen } from "@/components/Loader";
import { Select } from "@/components/Select";
import {
  useAddOrgMember,
  useMe,
  useOrgs,
  useOrgMembers,
  useRemoveOrgMember,
  useUpdateOrgMemberRole,
} from "@/lib/api";
import { roleLabel } from "@/lib/roles";

const ORG_ROLES = ["admin", "member"];

export default function MembersPage() {
  const { data: me } = useMe();
  const { data: orgs, isLoading } = useOrgs();
  const adminOrgs = (orgs ?? []).filter((o) => o.my_role === "admin");

  const [orgId, setOrgId] = useState<string | null>(null);
  useEffect(() => {
    if (!orgId && adminOrgs.length) setOrgId(adminOrgs[0].id);
  }, [adminOrgs, orgId]);

  const { data: members, isLoading: membersLoading } = useOrgMembers(orgId);
  const addMember = useAddOrgMember(orgId ?? "");
  const removeMember = useRemoveOrgMember(orgId ?? "");
  const updateRole = useUpdateOrgMemberRole(orgId ?? "");

  if (isLoading) return <LoaderScreen message="Loading organizations" />;

  if (adminOrgs.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Members</h1>
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          You don’t administer any organization yet. Create one in{" "}
          <a href="/settings" className="text-indigo-600 hover:underline">
            Settings
          </a>{" "}
          to manage members.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Members</h1>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <Building2 className="h-4 w-4" />
          Organization
          <Select
            value={orgId ?? ""}
            onChange={setOrgId}
            options={adminOrgs.map((o) => ({ value: o.id, label: o.name }))}
          />
        </label>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <Users className="h-5 w-5 text-indigo-600" /> Organization members
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          New members are automatically added to this org’s default project as editors. Add them to
          other projects from each project’s settings.
        </p>

        <AddMemberSearch
          roles={ORG_ROLES}
          excludeIds={(members ?? []).map((m) => m.user_id)}
          pending={addMember.isPending}
          onAdd={(userId, role) =>
            addMember.mutate({ userId, role }, { onSuccess: () => toast.success("Member added") })
          }
        />

        <div className="mt-5">
          {membersLoading ? (
            <div className="flex justify-center py-6">
              <Loader size={28} />
            </div>
          ) : (
            <ul className="divide-y">
              {members?.map((m) => {
                const isSelf = m.user_id === me?.id;
                return (
                  <li key={m.user_id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.username} size={32} />
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {m.username}
                        {isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={m.role}
                        disabled={isSelf}
                        onChange={(role) => updateRole.mutate({ userId: m.user_id, role })}
                        options={ORG_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
                      />
                      {m.role === "admin" && <ShieldCheck className="h-4 w-4 text-indigo-500" />}
                      {!isSelf && (
                        <button
                          onClick={() => removeMember.mutate(m.user_id)}
                          title="Remove from organization"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
