"use client";

import { useParams } from "next/navigation";
import { ErrorScreen } from "@/components/ErrorScreen";
import { isValidUsername } from "@/lib/username";

export function UserNotFoundScreen() {
  const params = useParams<{ username?: string }>();
  const username = typeof params?.username === "string" ? params.username : "";
  return (
    <ErrorScreen
      code={isValidUsername(username) ? "not_found" : "invalid_username"}
      username={username}
    />
  );
}
