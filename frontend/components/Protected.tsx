import type { ReactNode } from "react";

/**
 * UX-only gate: hide controls the user can't use. NOT security — the backend
 * always enforces via OpenFGA (a hidden button that's called anyway gets 403).
 */
export function Protected({
  allowed,
  children,
}: {
  allowed: boolean | undefined;
  children: ReactNode;
}) {
  if (!allowed) return null;
  return <>{children}</>;
}
