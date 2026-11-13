import { notFound, redirect } from "next/navigation";
import { isValidUsername } from "@/lib/username";

// Short URL: /<username> -> /user/<username> (307, kept for existing links).
// Anything that cannot be a GitHub login (dots, extensions, slashes, long
// junk like /foo.php or /wp-login.php) is a real 404 instead of a redirect.
// /robots.txt, /sitemap.xml, /favicon.ico… have their own routes and never
// reach this segment.
export default async function UsernameRedirect({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  if (!isValidUsername(username)) notFound();
  redirect(`/user/${username}`);
}
