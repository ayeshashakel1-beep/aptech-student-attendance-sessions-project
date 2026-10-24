// Attendance calculations. Unmarked sessions are never counted as absent
// and are always excluded from the percentage denominator.
import type { AttendanceRecord, AttendanceStatus, CalculationRules, ClassSession } from "./types";

export interface StudentSummary {
  totalScheduled: number;
  completed: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  unmarked: number;
  /** null when there is nothing to divide by */
  percentage: number | null;
}

export function statusFor(
  records: AttendanceRecord[],
  sessionId: string,
  studentId: string,
): AttendanceStatus {
  return records.find((r) => r.sessionId === sessionId && r.studentId === studentId)?.status ?? "unmarked";
}

export function summarize(
  sessions: ClassSession[],
  records: AttendanceRecord[],
  studentId: string,
  rules: CalculationRules,
): StudentSummary {
  const active = sessions.filter((s) => s.status !== "cancelled");
  const s: StudentSummary = {
    totalScheduled: active.length,
    completed: active.filter((x) => x.status === "completed").length,
    present: 0, absent: 0, late: 0, excused: 0, unmarked: 0, percentage: null,
  };
  for (const sess of active) {
    const st = statusFor(records, sess.id, studentId);
    s[st] += 1;
  }
  let num = s.present;
  let den = s.present + s.absent;
  for (const [count, mode] of [[s.late, rules.late], [s.excused, rules.excused]] as const) {
    if (mode === "present") { num += count; den += count; }
    else if (mode === "absent") { den += count; }
  }
  s.percentage = den === 0 ? null : Math.round((num / den) * 1000) / 10;
  return s;
}

const STATUS_ALIASES: Record<string, Exclude<AttendanceStatus, "unmarked">> = {
  p: "present", present: "present", "1": "present", yes: "present", y: "present",
  a: "absent", absent: "absent", "0": "absent", no: "absent", n: "absent",
  l: "late", late: "late",
  e: "excused", excused: "excused", ex: "excused",
};

/** Returns a status, "unmarked" for blank cells, or null when the value is not recognised. */
export function normalizeStatus(value: string | undefined): AttendanceStatus | null {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "") return "unmarked";
  return STATUS_ALIASES[v] ?? null;
}
