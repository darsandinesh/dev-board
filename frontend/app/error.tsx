"use client";

import { ErrorState } from "@/components/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      code="500"
      title="Something went wrong"
      message="An unexpected error occurred. You can retry, or head back to your projects."
      action={
        <>
          <button
            onClick={reset}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Back to projects
          </a>
        </>
      }
    />
  );
}
