import { createFileRoute } from "@tanstack/react-router";
import { ImportHistoryPage } from "@/components/pages/ImportHistoryPage";

export const Route = createFileRoute("/import-history")({
  head: () => ({
    meta: [
      { title: "CSV Import History · Attendance Management" },
      { name: "description", content: "Manage uploaded CSV files and imported attendance." },
      { property: "og:title", content: "CSV Import History · Attendance Management" },
      { property: "og:description", content: "Manage uploaded CSV files and imported attendance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportHistoryPage,
});
