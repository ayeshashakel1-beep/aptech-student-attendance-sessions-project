import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/pages/DashboardPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Attendance Management" },
      { name: "description", content: "Overview of students, modules, sessions and attendance." },
      { property: "og:title", content: "Dashboard · Attendance Management" },
      { property: "og:description", content: "Overview of students, modules, sessions and attendance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});
