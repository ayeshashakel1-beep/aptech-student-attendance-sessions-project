import { createFileRoute } from "@tanstack/react-router";
import { StudentAttendanceSessionsPage } from "@/components/pages/StudentAttendanceSessionsPage";

export const Route = createFileRoute("/student-attendance-sessions")({
  head: () => ({ meta: [{ title: "Student Attendance Sessions · Attendance Management" }, { name: "description", content: "Search student attendance session records by curriculum, course, semester, and skill." }] }),
  component: StudentAttendanceSessionsPage,
});
