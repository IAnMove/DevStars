import type { Metadata } from "next";
import { UserNotFoundScreen } from "@/components/UserNotFoundScreen";

export const metadata: Metadata = {
  title: "User not found",
  robots: { index: false, follow: false },
};

// Rendered with HTTP 404 when the username is impossible or GitHub has
// recently answered that the user does not exist.
export default function UserNotFound() {
  return <UserNotFoundScreen />;
}
