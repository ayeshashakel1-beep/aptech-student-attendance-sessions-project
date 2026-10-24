import { createFileRoute } from "@tanstack/react-router";
import { AcademicStructurePage } from "@/components/pages/AcademicStructurePage";

export const Route = createFileRoute("/academic-structure")({
  head: () => ({
    meta: [
      { title: "Academic Structure · Attendance Management" },
      { name: "description", content: "Configure curricula, courses, semesters and modules." },
      { property: "og:title", content: "Academic Structure · Attendance Management" },
      { property: "og:description", content: "Configure curricula, courses, semesters and modules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcademicStructurePage,
});
