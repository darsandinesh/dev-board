"use client";

import { LayoutDashboard, Settings, SquareKanban, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Projects", icon: LayoutDashboard, exact: true },
  { href: "/profile", label: "Profile", icon: User, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2 px-5 py-4 text-white">
        <SquareKanban className="h-6 w-6 text-indigo-400" />
        <span className="text-lg font-semibold tracking-tight">DevBoard</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-slate-500">
        Keycloak · OpenFGA
      </div>
    </aside>
  );
}
