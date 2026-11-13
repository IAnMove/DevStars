"use client";

import { useParams } from "next/navigation";
import { ErrorScreen } from "@/components/ErrorScreen";
import { isValidUsername } from "@/lib/username";

// Rendered with HTTP 404 when the username is impossible or GitHub has
// recently answered that the user does not exist.
export default function UserNotFound() {
  const params = useParams<{ username?: string }>();
  const username = typeof params?.username === "string" ? params.username : "";
  return (
    <ErrorScreen
      code={isValidUsername(username) ? "not_found" : "invalid_username"}
      username={username}
    />
  );
}
