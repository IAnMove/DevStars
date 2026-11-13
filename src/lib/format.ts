import type { Language } from "@/lib/i18n";

/** BCP 47 locale used with Intl for the language picked in the UI. */
export function localeFor(language: Language): string {
  return language === "es" ? "es-ES" : "en-US";
}

/**
 * GitHub avatars are served at 460 px by default. Ask for the size we
 * actually paint (pass 2x the CSS size for high-density screens).
 */
export function sizedAvatarUrl(url: string, size: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("s", String(size));
    return parsed.toString();
  } catch {
    return url;
  }
}

export function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

/** `ratio` is 0–1. */
export function formatPercent(ratio: number, locale: string, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits }).format(ratio);
}
