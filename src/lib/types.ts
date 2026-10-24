// Core data interfaces for the Student Attendance Management System.
// Student IDs are always strings so leading zeros are preserved.

export interface Curriculum { id: string; name: string }
export interface Course { id: string; name: string; curriculumId: string }
export interface Semester { id: string; name: string; courseId: string }
export interface Module { id: string; name: string; semesterId: string }

export interface Student {
  studentId: string;
  bcNumber?: string | undefined;
  name: string;
  email?: string | undefined;
  batch?: string | undefined;
  curriculumId: string;
  courseId: string;
  semesterId: string;
}

export type SessionStatus = "scheduled" | "completed" | "cancelled";

export interface ClassSession {
  id: string;
  moduleId: string;
  number: number;
  title: string;
  date: string; // ISO yyyy-mm-dd, may be empty if unknown
  status: SessionStatus;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "unmarked";

export interface AttendanceRecord {
  sessionId: string;
  studentId: string;
  status: Exclude<AttendanceStatus, "unmarked">;
  importId?: string; // set when created by a CSV import
}

export type ImportStatus = "previewed" | "applied" | "file-deleted";

export interface StructureSelection {
  curriculumId: string;
  courseId: string;
  semesterId: string;
  moduleId: string;
}

export interface RejectedRow { rowNumber: number; reason: string; raw: Record<string, string> }

export interface ImportRecord {
  id: string;
  filename: string;
  uploadedAt: string;
  structure: StructureSelection;
  totalRows: number;
  importedRows: number;
  rejectedRows: number;
  status: ImportStatus;
  rawText: string | null; // null once the original file is deleted
  rejected: RejectedRow[];
}

/** How late / excused marks are treated in the attendance percentage. */
export type MarkTreatment = "present" | "absent" | "exclude";

export interface CalculationRules {
  late: MarkTreatment;
  excused: MarkTreatment;
  lowAttendanceThreshold: number; // percent
}
