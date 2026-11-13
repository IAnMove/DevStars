"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { Nav } from "@/components/Nav";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Footer } from "@/components/Footer";

/** Brand + main navigation + language switch. */
export function SiteHeader() {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <Nav />
      <LanguageSelector />
    </header>
  );
}

/**
 * Common page frame: skip link, header, <main> and footer. Used by the
 * profile page in every state (loading, error, loaded).
 */
export function PageShell({
  children,
  mainClassName = "",
}: {
  children: ReactNode;
  mainClassName?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-4 sm:py-6">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-purple-700 focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-white"
      >
        {t("nav.skip")}
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className={`flex-1 outline-none ${mainClassName}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
