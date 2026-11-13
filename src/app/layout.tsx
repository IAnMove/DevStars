import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import {
  OG_IMAGE_SIZE,
  SITE_CARD_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

const defaultTitle = `${SITE_NAME}: ${SITE_TAGLINE}`;

// Defaults for every page. Pages add their own canonical / Open Graph through
// pageMetadata() (no canonical here: children would inherit a wrong one).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: defaultTitle, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: defaultTitle,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [{ url: SITE_CARD_PATH, ...OG_IMAGE_SIZE, alt: defaultTitle }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: SITE_DESCRIPTION,
    images: [SITE_CARD_PATH],
  },
};

export const viewport: Viewport = {
  themeColor: "#030712",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang follows the language picked in the UI (see I18nProvider)
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
