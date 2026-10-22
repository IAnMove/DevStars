import type { Metadata } from "next";

// Solo <head>: canonical y hreflang por perfil.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const path = `/user/${encodeURIComponent(username)}`;
  return { alternates: { canonical: path, languages: { en: path, "x-default": path } } };
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
