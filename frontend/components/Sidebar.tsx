"use client";

import {
  Building2,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquareKanban,
  User,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useMe } from "@/lib/api";
import { useUiStore } from "@/lib/store";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  platformAdmin?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Projects", icon: LayoutDashboard, exact: true },
  { href: "/tenants", label: "Tenants", icon: Building2, exact: false, platformAdmin: true },
  { href: "/members", label: "Members", icon: Users, exact: false },
  { href: "/profile", label: "Profile", icon: User, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const { data: me } = useMe();
  const nav = NAV.filter((n) => !n.platformAdmin || me?.is_platform_admin);

  return (
    <aside
      className={`flex shrink-0 flex-col bg-slate-900 text-slate-300 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* brand + collapse toggle — the logo stays visible when collapsed */}
      <div
        className={`py-4 text-white ${
          collapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between px-5"
        }`}
      >
        <div className="flex items-center gap-2">
          <SquareKanban className="h-6 w-6 text-indigo-400" />
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight">DevBoard</span>
          )}
        </div>
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
        {nav.map(({ href, label, icon: Icon, exact }) => {
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

      {/* footer: sign out */}
      <div className="border-t border-slate-800 p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          title={collapsed ? "Sign out" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}
