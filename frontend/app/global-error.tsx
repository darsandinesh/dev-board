"use client";

import "./globals.css";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-center">
          <div className="text-5xl font-bold text-slate-900">500</div>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            A critical error occurred while loading the app.
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
