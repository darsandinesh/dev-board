"use client";

import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquareKanban,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUiStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Projects", icon: LayoutDashboard, exact: true },
  { href: "/profile", label: "Profile", icon: User, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`flex shrink-0 flex-col bg-slate-900 text-slate-300 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* brand + collapse toggle */}
      <div
        className={`flex items-center py-4 text-white ${
          collapsed ? "justify-center px-0" : "justify-between px-5"
        }`}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <SquareKanban className="h-6 w-6 text-indigo-400" />
            <span className="text-lg font-semibold tracking-tight">DevBoard</span>
          </div>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-5 py-4 text-xs text-slate-500">Keycloak · OpenFGA</div>
      )}
    </aside>
  );
}
