import { createFileRoute } from "@tanstack/react-router";
import { StudentsPage } from "@/components/pages/StudentsPage";

export const Route = createFileRoute("/students")({
  head: () => ({
    meta: [
      { title: "Students · Attendance Management" },
      { name: "description", content: "Search, add, edit and remove students." },
      { property: "og:title", content: "Students · Attendance Management" },
      { property: "og:description", content: "Search, add, edit and remove students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentsPage,
});
