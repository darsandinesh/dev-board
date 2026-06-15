/**
 * Custom kanban-themed loader: four bars rising and falling like a board
 * filling up. Used inline (Loader) and as a full-area screen (LoaderScreen).
 */

const BARS = [
  { color: "bg-slate-400", delay: "0ms" },
  { color: "bg-indigo-400", delay: "150ms" },
  { color: "bg-indigo-600", delay: "300ms" },
  { color: "bg-emerald-500", delay: "450ms" },
];

export function Loader({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex items-end gap-1"
      style={{ height: size }}
      role="status"
      aria-label="Loading"
    >
      {BARS.map((b, i) => (
        <span key={i} className={`kanban-bar ${b.color}`} style={{ animationDelay: b.delay }} />
      ))}
    </div>
  );
}

export function LoaderScreen({ message = "Loading" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-400">
      <Loader size={40} />
      <span className="text-sm font-medium tracking-wide">{message}…</span>
    </div>
  );
}
