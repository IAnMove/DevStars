import type { Metadata } from "next";
import { ErrorScreen } from "@/components/ErrorScreen";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <ErrorScreen code="page_not_found" />;
}
