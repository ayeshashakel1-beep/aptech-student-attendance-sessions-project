import { describe, expect, it } from "vitest";
import { normalizeStatus, summarize } from "./attendance";
import type { AttendanceRecord, ClassSession } from "./types";

const sess = (id: string, status: ClassSession["status"] = "completed"): ClassSession => ({
  id, moduleId: "m", number: Number(id), title: "", date: "", status,
});
const sessions = ["1", "2", "3", "4", "5"].map((i) => sess(i));
const rec = (sessionId: string, status: AttendanceRecord["status"]): AttendanceRecord => ({ sessionId, studentId: "007", status });

describe("attendance rules", () => {
  it("does not count unmarked sessions as absent or in the denominator", () => {
    const r = summarize(sessions, [rec("1", "present"), rec("2", "absent")], "007", { late: "exclude", excused: "exclude", lowAttendanceThreshold: 75 });
    expect(r.unmarked).toBe(3);
    expect(r.absent).toBe(1);
    expect(r.percentage).toBe(50);
  });
  it("excludes late/excused from the percentage when set to exclude", () => {
    const r = summarize(sessions, [rec("1", "present"), rec("2", "late"), rec("3", "excused")], "007", { late: "exclude", excused: "exclude", lowAttendanceThreshold: 75 });
    expect(r.percentage).toBe(100);
  });
  it("counts late as present when configured", () => {
    const r = summarize(sessions, [rec("1", "absent"), rec("2", "late")], "007", { late: "present", excused: "exclude", lowAttendanceThreshold: 75 });
    expect(r.percentage).toBe(50);
  });
  it("returns null percentage when nothing is marked", () => {
    expect(summarize(sessions, [], "007", { late: "exclude", excused: "exclude", lowAttendanceThreshold: 75 }).percentage).toBeNull();
  });
  it("ignores cancelled sessions", () => {
    expect(summarize([...sessions, sess("6", "cancelled")], [], "007", { late: "exclude", excused: "exclude", lowAttendanceThreshold: 75 }).totalScheduled).toBe(5);
  });
  it("treats blank cells as unmarked and rejects unknown values", () => {
    expect(normalizeStatus("")).toBe("unmarked");
    expect(normalizeStatus("P")).toBe("present");
    expect(normalizeStatus("maybe")).toBeNull();
  });
});
