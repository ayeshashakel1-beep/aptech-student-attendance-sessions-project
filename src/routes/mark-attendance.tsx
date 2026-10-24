import { createFileRoute } from "@tanstack/react-router";
import { MarkAttendancePage } from "@/components/pages/MarkAttendancePage";

export const Route = createFileRoute("/mark-attendance")({
  head: () => ({
    meta: [
      { title: "Mark Attendance · Attendance Management" },
      { name: "description", content: "Mark and update attendance for a class session." },
      { property: "og:title", content: "Mark Attendance · Attendance Management" },
      { property: "og:description", content: "Mark and update attendance for a class session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarkAttendancePage,
});
