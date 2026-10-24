import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/pages/SettingsPage";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Attendance Management" },
      { name: "description", content: "Attendance calculation rules." },
      { property: "og:title", content: "Settings · Attendance Management" },
      { property: "og:description", content: "Attendance calculation rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});
