"use client";

import { Building2, FolderKanban, Rocket, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/Card";

type Step = { icon: LucideIcon; title: string; body: string; done?: boolean };

/**
 * First-run guidance shown on Home when the user has no projects yet.
 * Steps are tailored to the user's role so nobody stares at an empty screen.
 */
export function GettingStarted({
  isPlatformAdmin,
  hasAdminOrg,
}: {
  isPlatformAdmin: boolean;
  hasAdminOrg: boolean;
}) {
  let steps: Step[];
  let cta: { href: string; label: string } | null = null;

  if (isPlatformAdmin) {
    steps = [
      {
        icon: Building2,
        title: "Create a tenant",
        body: "An organization is the top of the hierarchy. Provision one and assign its first admin.",
      },
      {
        icon: FolderKanban,
        title: "Add a project",
        body: "Inside a tenant, create a project (a board). You become its owner.",
      },
      {
        icon: UserPlus,
        title: "Invite your team",
        body: "Add members from the project's Settings — projects are private until you do.",
      },
    ];
    cta = { href: "/tenants", label: "Go to Tenants" };
  } else if (hasAdminOrg) {
    steps = [
      {
        icon: FolderKanban,
        title: "Create your first project",
        body: "Use the “New project…” box above. You'll be its owner and can manage everything.",
      },
      {
        icon: UserPlus,
        title: "Invite your team",
        body: "Open the project's Settings to add members — projects are private until you do.",
      },
      {
        icon: Sparkles,
        title: "Create issues",
        body: "Add tasks, stories, bugs and epics, then drag them across the board.",
      },
    ];
  } else {
    steps = [
      {
        icon: UserPlus,
        title: "Ask to be added",
        body: "Projects are private. An org or project admin needs to add you before you can see a board.",
      },
      {
        icon: FolderKanban,
        title: "Your projects appear here",
        body: "Once you're added, the projects you're part of will show up on this page.",
      },
    ];
  }

  return (
    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Rocket className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-slate-900">Welcome to DevBoard</h2>
          <p className="text-sm text-slate-500">A few steps to get your first board going.</p>
        </div>
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={i} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-indigo-600 shadow-sm ring-1 ring-indigo-100">
                {i + 1}
              </span>
              <div>
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <Icon className="h-4 w-4 text-indigo-500" />
                  {s.title}
                </div>
                <p className="text-sm text-slate-500">{s.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {cta && (
        <Link
          href={cta.href}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          <Building2 className="h-4 w-4" /> {cta.label}
        </Link>
      )}
    </Card>
  );
}
