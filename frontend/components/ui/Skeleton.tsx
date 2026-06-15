import { cn } from "@/lib/cn";

/** A single shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800", className)} />
  );
}

/** A board-shaped loading placeholder (3 columns of cards). */
export function BoardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((c) => (
        <div key={c} className="rounded-2xl border bg-slate-100/70 p-3 dark:bg-slate-900/60">
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 - c === 0 ? 1 : 3 - c }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl bg-white dark:bg-slate-800" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A list of card placeholders, e.g. for the projects grid. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}
