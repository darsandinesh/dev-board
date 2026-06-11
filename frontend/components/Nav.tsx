"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

export function Nav() {
  const { data: session, status } = useSession();
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <Link href="/" className="text-lg font-semibold">
        DevBoard
      </Link>
      <div className="text-sm">
        {status === "loading" ? null : session ? (
          <button
            onClick={() => signOut()}
            className="rounded bg-slate-200 px-3 py-1 hover:bg-slate-300"
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={() => signIn("keycloak")}
            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
