import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevBoard",
  description: "Multi-tenant task manager — Keycloak + OpenFGA",
};

// Runs before paint so the correct theme is applied with no flash of the wrong
// colors (FOUC). Mirrors lib/theme.ts (storage key `devboard-theme`).
const themeScript = `(function(){try{var t=localStorage.getItem('devboard-theme')||'system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
