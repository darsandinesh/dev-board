"use client";

import { Building2, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/ErrorState";
import { LoaderScreen } from "@/components/Loader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import {
  useCreateOrg,
  useMe,
  useOrgs,
  useUserSearch,
  type UserResult,
} from "@/lib/api";

export default function TenantsPage() {
  const { data: me, isLoading } = useMe();
  const { data: orgs } = useOrgs();
  const createOrg = useCreateOrg();

  const [name, setName] = useState("");
  const [adminQuery, setAdminQuery] = useState("");
  const [admin, setAdmin] = useState<UserResult | null>(null);
  const { data: candidates } = useUserSearch(adminQuery);

  if (isLoading) return <LoaderScreen message="Loading" />;

  // Role gate (UI): the backend still enforces platform-admin on POST /orgs.
  if (!me?.is_platform_admin) {
    return (
      <ErrorState
        code="403"
        title="Platform admins only"
        message="Tenant provisioning is restricted to platform administrators."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
        <p className="mt-1 text-sm text-slate-500">
          Provision organizations and assign their first tenant-admin. Each new
          tenant gets a default “General” project.
        </p>
      </div>

      {/* Create tenant */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <Plus className="h-5 w-5 text-indigo-600" /> New tenant
        </h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createOrg.mutate(
              { name, admin_user_id: admin?.id ?? null },
              {
                onSuccess: () => {
                  setName("");
                  setAdmin(null);
                  setAdminQuery("");
                  toast.success("Tenant created");
                },
              },
            );
          }}
        >
          <div>
            <Label>Tenant name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>

          <div>
            <Label>Initial tenant-admin (optional — defaults to you)</Label>
            {admin ? (
              <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">
                  {admin.username}{" "}
                  <span className="text-slate-400">({admin.email})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setAdmin(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={adminQuery}
                  onChange={(e) => setAdminQuery(e.target.value)}
                  placeholder="Search a user to make tenant-admin…"
                />
                {adminQuery && candidates && candidates.length > 0 && (
                  <ul className="mt-1 max-h-40 divide-y overflow-auto rounded-lg border bg-white">
                    {candidates.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setAdmin(u)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <span className="font-medium text-slate-700">{u.username}</span>
                          <span className="text-xs text-slate-400">{u.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <Button disabled={createOrg.isPending || !name.trim()}>
            <Building2 className="h-4 w-4" /> Create tenant
          </Button>
        </form>
      </Card>

      {/* All tenants */}
      <Card>
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Building2 className="h-5 w-5 text-indigo-600" /> All tenants
          <span className="ml-1 rounded-full bg-slate-100 px-2 text-xs text-slate-500">
            {orgs?.length ?? 0}
          </span>
        </h2>
        {orgs && orgs.length > 0 ? (
          <ul className="mt-4 divide-y">
            {orgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium text-slate-700">{o.name}</span>
                <Link
                  href="/members"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Manage members
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No tenants yet.</p>
        )}
      </Card>
    </div>
  );
}
