import { readApiJson, uploadSessionRows } from "@/lib/sessionUpload";
import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { AlertCircle, CheckCircle2, FileUp, Search, Database, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, LocalNotice } from "@/components/shared";
import { ACADEMIC_CATALOG } from "@/lib/academicCatalog";

type LogRow = {
  studentId: string; studentName: string; courseCode: string; courseName: string; termName: string;
  termSequence: string; moduleName: string; moduleSequence: string; sessionName: string;
  sessionSequence: number; attendanceDate: string; centerName: string;
};
type ModuleSummary = { moduleName: string; termName: string; termSequence: number; courseCode: string; courseName: string; moduleSequence: string; sessionNumbers: number[]; rows: LogRow[]; total: number | null; missing: number[]; hasCsvRecords: boolean; };

const REQUIRED = ["StudentID", "StudentName", "CourseCode", "TermName", "TermSequence", "ModuleName", "ModuleSequence", "SessionName", "SessionSequence", "AttendanceDate"];
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const curriculumCodeFromCourse = (code: string) => code.match(/(?:^|\D)(7144|7062)(?:\D|$)/)?.[1] ?? "";

export function StudentSessionTrackerPage() {
  const [studentId, setStudentId] = useState("Student1692755");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [summary, setSummary] = useState<{ rows: number; students: number; imported: boolean } | null>(null);
  const [plans, setPlans] = useState<Record<string, number>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      const [statsResponse, plansResponse] = await Promise.all([fetch("/api/session-log"), fetch("/api/session-plans")]);
      if (!statsResponse.ok || !plansResponse.ok) throw new Error("Local database is not responding.");
      setSummary(await statsResponse.json());
      setPlans(await plansResponse.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect to the local database."); }
  }, []);
  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const searchStudent = useCallback(async (id = studentId) => {
    const trimmed = id.trim();
    if (!trimmed) { setError("Student ID enter karo."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/session-log?studentId=${encodeURIComponent(trimmed)}`);
      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error ?? "Student search failed.");
      setRows(body.rows ?? []);
      if (!body.rows?.length) setMessage(`Student ID ${trimmed} uploaded CSV mein nahi mila.`);
      else setMessage(`${body.rows.length} session-log rows found for ${trimmed}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Student search failed."); }
    finally { setBusy(false); }
  }, [studentId]);

  const uploadCsv = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(""); setMessage(""); setRows([]);
    try {
      const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, { header: true, skipEmptyLines: "greedy", dynamicTyping: false, complete: resolve, error: reject });
      });
      const headers = parsed.meta.fields ?? [];
      const missingHeaders = REQUIRED.filter((h) => !headers.includes(h));
      if (missingHeaders.length) throw new Error(`CSV ke required columns nahi mile: ${missingHeaders.join(", ")}`);
      if (!parsed.data.length) throw new Error("CSV file mein data rows nahi hain.");
      const cleanRows = parsed.data.map((r) => ({
        studentId: String(r.StudentID ?? "").trim(), studentName: String(r.StudentName ?? "").trim(),
        courseCode: String(r.CourseCode ?? "").trim(), courseName: String(r.CourseName ?? "").trim(),
        termName: String(r.TermName ?? "").trim(), termSequence: String(r.TermSequence ?? "").trim(),
        moduleName: String(r.ModuleName ?? "").trim(), moduleSequence: String(r.ModuleSequence ?? "").trim(),
        sessionName: String(r.SessionName ?? "").trim(), sessionSequence: Number(String(r.SessionSequence ?? "").trim()),
        attendanceDate: String(r.AttendanceDate ?? "").trim(), centerName: String(r.CenterName ?? "").trim(),
      })).filter((r) => r.studentId && r.moduleName && Number.isInteger(r.sessionSequence) && r.sessionSequence > 0);
      if (!cleanRows.length) throw new Error("CSV mein valid StudentID, ModuleName aur SessionSequence wali rows nahi milin.");
      const result = await uploadSessionRows(file.name, cleanRows);
      setMessage(`${result.importedRows.toLocaleString()} rows local database mein save huin; ${result.distinctStudents.toLocaleString()} unique students.`);
      await loadSummary();
      await searchStudent(studentId);
    } catch (e) { setError(e instanceof Error ? e.message : "CSV import failed."); }
    finally { setBusy(false); }
  };

  const summaries = useMemo<ModuleSummary[]>(() => {
    const groups = new Map<string, LogRow[]>();
    for (const row of rows) {
      const code = curriculumCodeFromCourse(row.courseCode);
      const key = `${code}|${Number(row.termSequence)}|${normalize(row.moduleName)}`;
      const group = groups.get(key) ?? [];
      group.push(row); groups.set(key, group);
    }
    const first = rows[0];
    const curriculumCodes = [...new Set(rows.map((row) => curriculumCodeFromCourse(row.courseCode)).filter(Boolean))];
    const result: ModuleSummary[] = [];
    const build = (group: LogRow[], moduleName: string, termName: string, termSequence: number, moduleSequence: string, catalogTotal: number | null, courseCode: string, courseName: string): ModuleSummary => {
      const sessionNumbers = [...new Set(group.map((r) => Number(r.sessionSequence)).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
      const total = catalogTotal ?? plans[moduleName] ?? null;
      const missing = total === null ? [] : Array.from({ length: total }, (_, i) => i + 1).filter((n) => !sessionNumbers.includes(n));
      return { moduleName, termName, termSequence, courseCode, courseName, moduleSequence, sessionNumbers, rows: group, total, missing, hasCsvRecords: group.length > 0 };
    };
    for (const curriculumCode of curriculumCodes) {
      for (const catalog of ACADEMIC_CATALOG.filter((m) => m.curriculumCode === curriculumCode)) {
        const key = `${catalog.curriculumCode}|${catalog.semester}|${normalize(catalog.name)}`;
        const group = groups.get(key) ?? [];
        const row = group[0];
        result.push(build(group, catalog.name, row?.termName ?? `SEMESTER ${String(catalog.semester).padStart(2, "0")}`, catalog.semester, catalog.code, catalog.totalSessions, row?.courseCode ?? first?.courseCode ?? `OV-${curriculumCode}`, catalog.courseName));
      }
    }
    // Only report modules in the supplied plan. Similar-looking but different modules
    // (for example Progressive Website Development vs eProject-Responsive Website Development)
    // are intentionally not merged or added as unplanned rows.
    return result.sort((a, b) => a.termSequence - b.termSequence || a.moduleName.localeCompare(b.moduleName));
  }, [rows, plans]);

  const savePlan = async (moduleName: string, defaultTotal: number) => {
    const totalSessions = Number(planDrafts[moduleName] ?? String(defaultTotal));
    if (!Number.isInteger(totalSessions) || totalSessions < 1 || totalSessions > 200) { setError("Total sessions 1 se 200 ke darmiyan whole number hona chahiye."); return; }
    setError("");
    try {
      const response = await fetch("/api/session-plans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleName, totalSessions }) });
      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error ?? "Session total save nahi hua.");
      setPlans((p) => ({ ...p, [moduleName]: totalSessions }));
      setPlanDrafts((p) => ({ ...p, [moduleName]: "" }));
      setMessage(`Planned total ${totalSessions} sessions save ho gaye: ${moduleName}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save session total."); }
  };

  const firstRow = rows[0];
  const totalMissing = summaries.filter((s) => s.total !== null).reduce((n, s) => n + s.missing.length, 0);
  const totalKnown = summaries.filter((s) => s.total !== null && s.hasCsvRecords).length;

  return <div>
    <PageHeader title="Student Session Tracker" description="Student ID search karo aur har module ke recorded aur missing session numbers dekho." />
    <LocalNotice>CSV mein Present/Absent ya marks ka column nahi hai. Is report mein CSV row ko “session record mila” maana gaya hai; missing session ka matlab CSV mein record nahi mila, confirmed absence nahi.</LocalNotice>
    <Card className="mb-5">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileUp className="h-5 w-5" /> 1. Attendance session CSV database mein upload karo</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <input type="file" accept=".csv,text/csv" aria-label="Upload session CSV" disabled={busy} onChange={(e) => { void uploadCsv(e.target.files?.[0]); e.currentTarget.value = ""; }} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2" />
        <p className="text-xs text-muted-foreground">Expected columns include StudentID, CourseCode, TermName, ModuleName and SessionSequence. Uploading a new CSV replaces the previous session-log import in this local database.</p>
        {summary?.imported && <p className="flex items-center gap-2 text-sm"><Database className="h-4 w-4" /> Database mein {summary.rows.toLocaleString()} rows aur {summary.students.toLocaleString()} unique students hain.</p>}
      </CardContent>
    </Card>
    <Card className="mb-5">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Search className="h-5 w-5" /> 2. Student ID search karo</CardTitle></CardHeader>
      <CardContent><form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void searchStudent(); }}>
        <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student1692755" aria-label="Student ID" className="font-mono" />
        <Button type="submit" disabled={busy}><Search className="mr-2 h-4 w-4" /> Search Student</Button>
      </form></CardContent>
    </Card>
    {error && <div role="alert" className="mb-4 flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertCircle className="h-4 w-4 shrink-0 text-destructive" />{error}</div>}
    {message && <div role="status" className="mb-4 flex gap-2 rounded-md border p-3 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</div>}
    {rows.length > 0 && <div className="space-y-4">
      <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-3">
        <div><p className="text-sm text-muted-foreground">Student</p><p className="font-semibold">{firstRow?.studentName}</p><p className="font-mono text-sm">{firstRow?.studentId}</p></div>
        <div><p className="text-sm text-muted-foreground">Course</p><p className="font-semibold">{firstRow?.courseName} ({firstRow?.courseCode})</p></div>
        <div><p className="text-sm text-muted-foreground">Modules with planned totals</p><p className="text-2xl font-bold">{totalKnown} / {summaries.length}</p><p className="text-xs text-muted-foreground">Missing session records across configured modules: {totalMissing}</p></div>
      </CardContent></Card>
      {summaries.map((item) => <Card key={`${item.termSequence}-${item.moduleName}`}>
        <CardHeader className="pb-3"><CardTitle className="text-base">{item.moduleName}</CardTitle><p className="text-xs text-muted-foreground">{item.courseName} · {item.termName} · Module {item.moduleSequence} · {item.rows.length} CSV rows</p></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Planned sessions</p><p className="text-xl font-semibold">{item.total ?? "Not configured"}</p></div>
            <div className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Unique session numbers found</p><p className="text-xl font-semibold">{item.sessionNumbers.length}</p></div>
            <div className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Missing from CSV</p><p className="text-xl font-semibold">{item.total === null ? "Set total first" : item.missing.length}</p></div>
          </div>
          {item.hasCsvRecords ? <>
            <div><p className="mb-1 text-sm font-medium">Session numbers found</p><p className="text-sm">{item.sessionNumbers.length ? item.sessionNumbers.join(", ") : "None"}</p></div>
            {item.total !== null && <div><p className="mb-1 text-sm font-medium">Missing session numbers</p><p className={item.missing.length ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-emerald-700"}>{item.missing.length ? item.missing.join(", ") : "No missing session numbers within the planned total."}</p></div>}
          </> : <div className="space-y-2"><p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">Is module ke liye student ka koi matching session record CSV mein nahi mila. Iska matlab confirmed absence nahi; source export mein module/term ka naam different ho sakta hai.</p>{item.total !== null && <div><p className="mb-1 text-sm font-medium">Missing from CSV</p><p className="text-sm font-semibold text-destructive">{item.missing.length ? item.missing.join(", ") : "No missing session numbers within the planned total."}</p></div>}</div>}
          {item.total === null && <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void savePlan(item.moduleName, Math.max(...item.sessionNumbers, 1)); }}>
            <Input type="number" min={1} max={200} value={planDrafts[item.moduleName] ?? String(Math.max(...item.sessionNumbers, 1))} onChange={(e) => setPlanDrafts((p) => ({ ...p, [item.moduleName]: e.target.value }))} aria-label={`Planned total sessions for ${item.moduleName}`} />
            <Button type="submit" variant="outline"><Save className="mr-2 h-4 w-4" /> Save planned total</Button>
          </form>}
        </CardContent>
      </Card>)}
      <Card><CardHeader><CardTitle className="text-base">Session-level source records</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Term</TableHead><TableHead>Module</TableHead><TableHead>Session #</TableHead><TableHead>Session name</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{rows.slice().sort((a,b) => Number(a.termSequence)-Number(b.termSequence) || a.moduleName.localeCompare(b.moduleName) || a.sessionSequence-b.sessionSequence).map((r, i) => <TableRow key={`${r.termSequence}-${r.moduleName}-${r.sessionSequence}-${i}`}><TableCell>{r.termName}</TableCell><TableCell>{r.moduleName}</TableCell><TableCell>{r.sessionSequence}</TableCell><TableCell>{r.sessionName}</TableCell><TableCell>{r.attendanceDate}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>}
  </div>;
}
