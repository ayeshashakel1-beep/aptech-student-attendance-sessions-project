import { createFileRoute } from "@tanstack/react-router";
import { StudentSessionTrackerPage } from "@/components/pages/StudentSessionTrackerPage";

export const Route = createFileRoute("/student-tracker")({
  head: () => ({ meta: [{ title: "Student Session Tracker · Attendance Management" }, { name: "description", content: "Search a student ID and identify session records missing from the uploaded CSV." }] }),
  component: StudentSessionTrackerPage,
});
