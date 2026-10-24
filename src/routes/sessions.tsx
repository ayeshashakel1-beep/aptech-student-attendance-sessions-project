import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "@/components/pages/SessionsPage";

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [
      { title: "Attendance Sessions · Attendance Management" },
      { name: "description", content: "View and manage class sessions for a module." },
      { property: "og:title", content: "Attendance Sessions · Attendance Management" },
      { property: "og:description", content: "View and manage class sessions for a module." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionsPage,
});
