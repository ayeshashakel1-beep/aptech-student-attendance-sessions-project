// Pure CSV validation logic. Column structure is never assumed —
// the administrator maps columns after seeing the file.
import Papa from "papaparse";
import { normalizeStatus } from "./attendance";
import type { AttendanceRecord, AttendanceStatus, ClassSession, RejectedRow, Student } from "./types";

export type CsvFormat = "long" | "matrix" | "summary";
export type SessionKey = "number" | "date";

export interface ParsedCsv { headers: string[]; rows: Record<string, string>[]; errors: string[] }

export function parseCsv(text: string): ParsedCsv {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
  return {
    headers: (res.meta.fields ?? []).filter((h) => h !== ""),
    rows: res.data,
    errors: res.errors.slice(0, 20).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`),
  };
}

export interface Mapping {
  format: CsvFormat;
  studentCol: string;
  bcCol: string; // optional: verify booking confirmation number against the student record
  // long format
  sessionCol: string;
  sessionKey: SessionKey;
  statusCol: string;
  // matrix format: chosen columns in order => session 1..n
  matrixCols: string[];
}

export interface PendingMark { rowNumber: number; studentId: string; sessionNumber: number | null; date: string; status: AttendanceStatus }

export interface ValidationResult {
  valid: PendingMark[];
  rejected: RejectedRow[];
  unknownStudentIds: string[];
  duplicates: number;
  missingSessions: { number: number | null; date: string }[];
  conflicts: PendingMark[]; // valid marks that differ from an existing record
  totalRows: number;
}

const isoDate = (v: string) => {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
};

export function findSession(sessions: ClassSession[], m: { sessionNumber: number | null; date: string }) {
  return m.sessionNumber !== null ? sessions.find((s) => s.number === m.sessionNumber) : sessions.find((s) => s.date === m.date);
}

export function validate(
  parsed: ParsedCsv, map: Mapping, students: Student[], moduleSessions: ClassSession[],
  existing: AttendanceRecord[], allowCreateSessions: boolean,
): ValidationResult {
  const known = new Set(students.map((s) => s.studentId));
  const studentsById = new Map(students.map((s) => [s.studentId, s]));
  const out: ValidationResult = { valid: [], rejected: [], unknownStudentIds: [], duplicates: 0, missingSessions: [], conflicts: [], totalRows: parsed.rows.length };
  const unknown = new Set<string>();
  const seen = new Set<string>();
  const missing = new Map<string, { number: number | null; date: string }>();

  const consider = (rowNumber: number, raw: Record<string, string>, studentId: string, sessionNumber: number | null, date: string, statusRaw: string) => {
    const status = normalizeStatus(statusRaw);
    if (status === null) return void out.rejected.push({ rowNumber, raw, reason: `Unrecognised status "${statusRaw}"` });
    const key = `${studentId}|${sessionNumber ?? date}`;
    if (seen.has(key)) { out.duplicates++; return void out.rejected.push({ rowNumber, raw, reason: `Duplicate entry for ${studentId}, session ${sessionNumber ?? date}` }); }
    seen.add(key);
    const mark = { rowNumber, studentId, sessionNumber, date, status };
    const sess = findSession(moduleSessions, mark);
    if (!sess) {
      missing.set(String(sessionNumber ?? date), { number: sessionNumber, date });
      if (!allowCreateSessions) return void out.rejected.push({ rowNumber, raw, reason: `Session ${sessionNumber ?? date} does not exist for this module` });
    } else if (status !== "unmarked") {
      const ex = existing.find((r) => r.sessionId === sess.id && r.studentId === studentId);
      if (ex && ex.status !== status) out.conflicts.push(mark);
    }
    out.valid.push(mark);
  };

  parsed.rows.forEach((raw, i) => {
    const rowNumber = i + 2; // header is row 1
    const studentId = (raw[map.studentCol] ?? "").trim();
    if (!studentId) return void out.rejected.push({ rowNumber, raw, reason: "Missing student ID" });
    if (!known.has(studentId)) { unknown.add(studentId); return void out.rejected.push({ rowNumber, raw, reason: `Unknown student ID ${studentId}` }); }
    if (map.bcCol) {
      const bc = (raw[map.bcCol] ?? "").trim();
      const studentBc = (studentsById.get(studentId)?.bcNumber ?? "").trim();
      if (!bc) return void out.rejected.push({ rowNumber, raw, reason: "Missing BC Number" });
      if (!studentBc) return void out.rejected.push({ rowNumber, raw, reason: `Student ${studentId} has no BC Number saved in the student list` });
      if (bc.toLowerCase() !== studentBc.toLowerCase()) return void out.rejected.push({ rowNumber, raw, reason: `BC Number does not match Student ID ${studentId}` });
    }

    if (map.format === "long") {
      const keyVal = (raw[map.sessionCol] ?? "").trim();
      if (map.sessionKey === "number") {
        const n = Number(keyVal);
        if (!Number.isInteger(n) || n < 1) return void out.rejected.push({ rowNumber, raw, reason: `Invalid session number "${keyVal}"` });
        consider(rowNumber, raw, studentId, n, "", raw[map.statusCol] ?? "");
      } else {
        const d = isoDate(keyVal);
        if (!d) return void out.rejected.push({ rowNumber, raw, reason: `Invalid date "${keyVal}"` });
        consider(rowNumber, raw, studentId, null, d, raw[map.statusCol] ?? "");
      }
    } else if (map.format === "matrix") {
      map.matrixCols.forEach((col, idx) => consider(rowNumber, raw, studentId, idx + 1, isoDate(col) ?? "", raw[col] ?? ""));
    }
  });
  out.unknownStudentIds = [...unknown];
  out.missingSessions = [...missing.values()];
  return out;
}

export function rejectedToCsv(rows: RejectedRow[]) {
  return Papa.unparse(rows.map((r) => ({ "Row number": r.rowNumber, Reason: r.reason, ...r.raw })));
}
