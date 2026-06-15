import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
      {Icon && <Icon className="mx-auto mb-2 h-8 w-8 text-slate-300" />}
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}
