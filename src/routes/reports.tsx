import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/pages/ReportsPage";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Attendance Reports · Attendance Management" },
      { name: "description", content: "Attendance summaries and session-wise matrix." },
      { property: "og:title", content: "Attendance Reports · Attendance Management" },
      { property: "og:description", content: "Attendance summaries and session-wise matrix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});
