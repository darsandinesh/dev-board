"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";

import { useThemeEffect, useThemeStore } from "@/lib/theme";

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "detail" in err) {
    const d = (err as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function Providers({ children }: { children: ReactNode }) {
  useThemeEffect();
  const theme = useThemeStore((s) => s.theme);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
        // Surface any mutation failure as a toast, app-wide.
        mutationCache: new MutationCache({
          onError: (err) => toast.error(errorMessage(err)),
        }),
      }),
  );
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-right" closeButton theme={theme} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
