import { redirect } from "next/navigation";

// Short URL: /<username> -> /user/<username>
export default async function UsernameRedirect({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  redirect(`/user/${username}`);
}
