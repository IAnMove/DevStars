import type { Metadata } from "next";
import { HomeSearch } from "@/components/HomeSearch";
import { pageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

const base = pageMetadata({
  title: SITE_TAGLINE,
  description: SITE_DESCRIPTION,
  path: "/",
});

export const metadata: Metadata = {
  ...base,
  // The home page is the one place where the brand goes first
  title: { absolute: `${SITE_NAME}: ${SITE_TAGLINE}` },
};

export default function Home() {
  return <HomeSearch />;
}
