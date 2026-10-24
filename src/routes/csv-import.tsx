import { createFileRoute } from "@tanstack/react-router";
import { CsvImportPage } from "@/components/pages/CsvImportPage";

export const Route = createFileRoute("/csv-import")({
  head: () => ({
    meta: [
      { title: "CSV Import · Attendance Management" },
      { name: "description", content: "Upload, map, validate and import attendance CSV files." },
      { property: "og:title", content: "CSV Import · Attendance Management" },
      { property: "og:description", content: "Upload, map, validate and import attendance CSV files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CsvImportPage,
});
