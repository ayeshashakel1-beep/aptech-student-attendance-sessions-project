import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { readApiJson, uploadSessionRows } from "@/lib/sessionUpload";
import { AlertCircle, CheckCircle2, FileUp, Search, CalendarCheck, Percent, Trash2, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACADEMIC_CATALOG } from "@/lib/academicCatalog";

type ImportBatch = { id: string; filename: string; uploadedAt: string; rowCount: number; distinctStudents: number };
type LogRow = {
  studentId: string; studentName: string; courseCode: string; courseName: string; termName: string;
  termSequence: string; moduleName: string; moduleSequence: string; sessionName: string;
  sessionSequence: number; attendanceDate: string; centerName: string;
};
const REQUIRED = ["StudentID", "StudentName", "CourseCode", "TermName", "TermSequence", "ModuleName", "ModuleSequence", "SessionName", "SessionSequence", "AttendanceDate"];
// These 7144 modules have planned sessions but no portal sessions in the supplied exports.
// Treat unreported modules as unavailable, not 0% attendance.
const pending7144 = new Set([
  "Dart Programming", "Cross-Platform App Development with Flutter and Dart", "Data Science with Python",
  "AI Applications of NLP", "Applied Machine Learning using Python", "Deep Learning using Neural Networks",
]);
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
const curriculumFrom = (v: string) => v.match(/(?:^|\D)(7144|7062)(?:\D|$)/)?.[1] ?? "";
const rowIdentity = (r: LogRow) => [r.studentId, r.studentName, r.courseCode, r.courseName, r.termName, r.termSequence, r.moduleName, r.moduleSequence, r.sessionName, r.sessionSequence, r.attendanceDate, r.centerName].join("\u001f");
const uniqueRows = (source: LogRow[]) => [...new Map(source.map((r) => [rowIdentity(r), r])).values()];

export function StudentAttendanceSessionsPage() {
  const [studentId, setStudentId] = useState("");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [curriculum, setCurriculum] = useState("7144");
  const [course, setCourse] = useState("ALL");
  const [semester, setSemester] = useState("ALL");
  const [module, setModule] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadFilesStatus, setUploadFilesStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [importDataProblem, setImportDataProblem] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const refreshImports = async () => {
    const response = await fetch("/api/session-log");
    const body = await readApiJson(response);
    if (!response.ok) throw new Error(body.error ?? "Import list load nahi hui.");
    setImports((body.imports ?? []) as ImportBatch[]);
    setImportDataProblem(body.importIntegrity === false);
  };
  useEffect(() => { void refreshImports().catch((e) => setError(e instanceof Error ? e.message : "Import list load nahi hui.")); }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animate = () => {
      const gsap = (window as Window & { gsap?: { from: (target: string, options: Record<string, unknown>) => void } }).gsap;
      gsap?.from(".sas-hero, .sas-panel", { opacity: 0, y: 16, duration: 0.7, stagger: 0.08, ease: "power2.out", clearProps: "all" });
    };
    if ((window as Window & { gsap?: unknown }).gsap) { animate(); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
    script.async = true;
    script.onload = animate;
    document.head.appendChild(script);
    return () => {script.onload = null;};
  }, []);

  const search = async (id = studentId) => {
    if (!id.trim()) { setError("Enter Student ID."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/session-log?studentId=${encodeURIComponent(id.trim())}`);
      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error ?? "Student search nahi ho saka.");
      const found = uniqueRows((body.rows ?? []) as LogRow[]);
      setRows(found);
      if (found.length) {
        setMessage(`${found.length.toLocaleString()} stored records found. Results reflect imported files only; re-upload a newer export if portal sessions are missing.`);
      } else setMessage(`Student ID ${id.trim()} ke records imported CSV mein nahi mile. Pehle CSV import karein.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Student search fail ho gayi."); }
    finally { setBusy(false); }
  };

  const upload = async (files?: FileList | null) => {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    setBusy(true); setError(""); setMessage("");
    let successCount = 0;
    setUploadPercent(0);
    const failures: string[] = [];
    try {
      for (const [index, file] of selectedFiles.entries()) {
        setUploadFilesStatus(`File ${index + 1} of ${selectedFiles.length}: ${file.name}`);
        try {
          const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => Papa.parse<Record<string, string>>(file, { header: true, skipEmptyLines: "greedy", dynamicTyping: false, complete: resolve, error: reject }));
          if (parsed.errors.length) throw new Error(`CSV parse error at row ${parsed.errors[0].row ?? "?"}: ${parsed.errors[0].message}`);
          const headers = parsed.meta.fields ?? [];
          const missing = REQUIRED.filter((h) => !headers.includes(h));
          if (missing.length) throw new Error(`columns missing: ${missing.join(", ")}`);
          const clean = parsed.data.map((r) => ({
            studentId: (r["StudentID"] ?? "").trim(), studentName: (r["StudentName"] ?? "").trim(), courseCode: (r["CourseCode"] ?? "").trim(), courseName: (r["CourseName"] ?? "").trim(),
            termName: (r["TermName"] ?? "").trim(), termSequence: (r["TermSequence"] ?? "").trim(), moduleName: (r["ModuleName"] ?? "").trim(), moduleSequence: (r["ModuleSequence"] ?? "").trim(),
            sessionName: (r["SessionName"] ?? "").trim(), sessionSequence: Number((r["SessionSequence"] ?? "").trim()), attendanceDate: (r["AttendanceDate"] ?? "").trim(), centerName: (r.CenterName ?? "").trim(),
          }));
          const invalidIndex = clean.findIndex((r) => !r.studentId || !r.moduleName || !Number.isInteger(r.sessionSequence) || r.sessionSequence <= 0);
          if (invalidIndex !== -1) throw new Error(`Invalid required CSV data at row ${invalidIndex + 2}. No rows from this file were imported.`);
          if (!clean.length) throw new Error("No student/session records found.");
          await uploadSessionRows(file.name, clean, (done, total) => { setUploadProgress(`${file.name}: ${done.toLocaleString()} / ${total.toLocaleString()} rows saved`); setUploadPercent(Math.round(((index + done / total) / selectedFiles.length) * 100)); });
          successCount++;
        } catch (e) { failures.push(`${file.name}: ${e instanceof Error ? e.message : "import fail"}`); }
      }
      await refreshImports();
      if (successCount) {
        setMessage(`${successCount} CSV file(s) imported and verified against saved database row counts.`);
        if (studentId.trim()) await search(studentId);
      }
      if (failures.length) setError(failures.join(" | "));
    } catch (e) { setError(e instanceof Error ? e.message : "CSV import fail ho gayi."); }
    finally { setBusy(false); setUploadProgress(""); setUploadFilesStatus(""); setUploadPercent(0); }
  };

  const deleteImport = async (item: ImportBatch) => {
    if (!window.confirm(`Kya aap "${item.filename}" aur is file ke ${item.rowCount.toLocaleString()} records delete karna chahte hain?`)) return;
    setDeletingId(item.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/session-log/imports/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const body = await readApiJson(response);
      if (!response.ok) throw new Error(body.error ?? "File delete nahi hui.");
      await refreshImports();
      if (studentId.trim()) await search(studentId);
      else setRows([]);
      setMessage(`${item.filename} aur iske records delete kar diye gaye.`);
    } catch (e) { setError(e instanceof Error ? e.message : "File delete nahi hui."); }
    finally { setDeletingId(""); }
  };

  const courses = useMemo(() => [...new Set(ACADEMIC_CATALOG.filter((m) => m.curriculumCode === curriculum).map((m) => m.courseName))], [curriculum]);
  const semesters = useMemo(() => [...new Set(ACADEMIC_CATALOG.filter((m) => m.curriculumCode === curriculum && (course === "ALL" || m.courseName === course)).map((m) => m.semester))].sort((a,b) => a-b), [curriculum, course]);
  const visibleModules = useMemo(() => ACADEMIC_CATALOG.filter((m) => m.curriculumCode === curriculum && (course === "ALL" || m.courseName === course) && (semester === "ALL" || String(m.semester) === semester) && (module === "ALL" || `${m.semester}|${m.courseName}|${m.name}` === module)).sort((a,b) => a.semester-b.semester || a.courseName.localeCompare(b.courseName) || a.code.localeCompare(b.code)), [curriculum, course, semester, module]);
  const studentRows = useMemo(() => rows.filter((r) => curriculumFrom(r.courseCode) === curriculum), [rows, curriculum]);
  const details = useMemo(() => visibleModules.map((item) => {
    // Match the exact planned skill within the student's selected curriculum AND semester.
    // Source ModuleSequence is a portal index, not the planned M1/M2 module code.
    // Source CourseName is often the full ADSE programme rather than CPISM/DISM.
    const matched = uniqueRows(studentRows.filter((r) =>
      norm(r.moduleName) === norm(item.portalName ?? item.name) && Number(r.termSequence) === item.semester
    ));
    const marked = [...new Set(matched.map((r) => Number(r.sessionSequence)).filter((n) => Number.isInteger(n) && n > 0 && n <= item.totalSessions))].sort((a,b) => a-b);
    const portalPending = item.curriculumCode === "7144" && pending7144.has(item.name) && marked.length === 0;
    const missing = portalPending ? [] : Array.from({ length: item.totalSessions }, (_, i) => i + 1).filter((n) => !marked.includes(n));
    return { ...item, matched, marked, missing, portalPending, percentage: Math.round(marked.length / item.totalSessions * 1000) / 10 };
  }), [visibleModules, studentRows]);
  const selectedCourse = course === "ALL" ? "ALL" : course;
  const studentCurricula = [...new Set(rows.map(r => curriculumFrom(r.courseCode)).filter(Boolean))];
  const wrongCurriculum = rows.length > 0 && !studentRows.length;
  const matchingSemesters = new Set(studentRows.map(r => Number(r.termSequence)));
  const studentModules = details.filter(item => matchingSemesters.has(item.semester));
  const displayedDetails = wrongCurriculum ? [] : studentModules;
  const filterHasNoData = rows.length > 0 && !wrongCurriculum && displayedDetails.length === 0;

  return <div className="sas-page">
    <div className="sas-hero mb-8 flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
      <div className="flex items-center gap-4"><img src="/aptech-logo.png" alt="Aptech" className="sas-hero-logo w-24 rounded-lg bg-white p-2 sm:w-36"/><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Aptech • Student Services</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">Student Attendance Sessions</h1><p className="mt-2 text-sm font-normal text-slate-200">Search by Student ID and review skill-wise session coverage.</p></div></div>
      <span className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-200">Curricula 7144 &amp; 7062</span>
    </div>
    <Card className="sas-panel sas-panel-first mb-6 border-sky-200/80 bg-gradient-to-br from-sky-50/70 via-background to-background dark:border-sky-900">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileUp className="h-5 w-5" /> 01 · CSV imports</CardTitle><p className="text-sm text-muted-foreground">Upload and manage CSV files.</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/60 p-4 dark:border-sky-800 dark:bg-sky-950/20">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-sky-800 dark:text-sky-200"><Files className="h-4 w-4" /> Upload multiple CSV files</div>
          <Input type="file" multiple accept=".csv,text/csv" disabled={busy} aria-label="Import multiple student session CSV files" onChange={(e) => { void upload(e.target.files); e.currentTarget.value = ""; }} className="bg-background file:font-semibold file:text-sky-700" />
          <p className="mt-2 text-xs text-sky-800 dark:text-sky-200">Select one or more CSV files. Re-upload the original export if a session is missing from an older import.</p>
          {uploadFilesStatus && <p role="status" className="mt-2 rounded-lg bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">{uploadFilesStatus}</p>}
          {uploadProgress && <div role="status" className="mt-3 rounded-xl border border-sky-200 bg-white p-3 dark:border-sky-900 dark:bg-sky-950/30"><div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-sky-900 dark:text-sky-100"><span>{uploadProgress}</span><span>{uploadPercent}%</span></div><div className="h-3 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950" role="progressbar" aria-label="CSV upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadPercent}><div className="h-full rounded-full bg-sky-600 transition-all" style={{width: `${uploadPercent}%`}} /></div></div>}
        </div>
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 font-semibold"><Files className="h-4 w-4" /> Imported CSV files ({imports.length})</div>
          {imports.length === 0 ? <p className="text-sm text-muted-foreground">No CSV files uploaded yet.</p> : <div className="sas-import-list max-h-64 space-y-2 overflow-y-auto pr-1">{imports.map((item) => <div key={item.id} className="sas-import-row flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all text-sm font-medium">{item.filename}</p><p className="text-xs text-muted-foreground">{item.rowCount.toLocaleString()} rows · {item.distinctStudents.toLocaleString()} students · {new Date(item.uploadedAt).toLocaleString()}</p></div><Button type="button" variant="destructive" size="sm" disabled={busy || deletingId === item.id} onClick={() => void deleteImport(item)}><Trash2 className="mr-2 h-4 w-4" />{deletingId === item.id ? "Deleting…" : "Delete file"}</Button></div>)}</div>}
        </div>
      </CardContent>
    </Card>
    <Card className="sas-panel mb-5">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Search className="h-5 w-5" /> 02 · Student search & filters</CardTitle><p className="text-sm text-muted-foreground">Search by Student ID and filter the report.</p></CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <Input value={studentId} onChange={(e) => { setStudentId(e.target.value); setRows([]); setMessage(""); setError(""); }} placeholder="Enter Student ID" aria-label="Student ID" className="font-mono" />
          <Button type="submit" disabled={busy || !studentId.trim()}><Search className="mr-2 h-4 w-4" /> Search Student</Button>
        </form>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 academic-filter-grid sas-filters">
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-background to-background p-4 shadow-sm transition-shadow hover:shadow-md dark:border-sky-900 dark:from-sky-950/40 space-y-3"><div className="mb-1"><Label className="block text-sm font-extrabold tracking-tight text-sky-800 dark:text-sky-200">Curriculum</Label><p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Curriculum code</p></div><Select value={curriculum} onValueChange={(v) => { setCurriculum(v); setCourse("ALL"); setSemester("ALL"); setModule("ALL"); }}><SelectTrigger aria-label="Curriculum" className="h-11 rounded-xl border-sky-200 bg-background text-base font-bold text-foreground shadow-sm focus:ring-sky-400 dark:border-sky-800"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7144">7144</SelectItem><SelectItem value="7062">7062</SelectItem></SelectContent></Select></div>
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-background to-background p-4 shadow-sm transition-shadow hover:shadow-md dark:border-violet-900 dark:from-violet-950/40 space-y-3"><div className="mb-1"><Label className="block text-sm font-extrabold tracking-tight text-violet-800 dark:text-violet-200">Course</Label><p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Course selection</p></div><Select value={selectedCourse} onValueChange={(v) => { setCourse(v); setSemester("ALL"); setModule("ALL"); }}><SelectTrigger aria-label="Course" className="h-11 rounded-xl border-violet-200 bg-background text-base font-bold text-foreground shadow-sm focus:ring-violet-400 dark:border-violet-800"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All courses</SelectItem>{courses.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-background to-background p-4 shadow-sm transition-shadow hover:shadow-md dark:border-emerald-900 dark:from-emerald-950/40 space-y-3"><div className="mb-1"><Label className="block text-sm font-extrabold tracking-tight text-emerald-800 dark:text-emerald-200">Semester</Label><p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Semester selection</p></div><Select value={semester} onValueChange={(v) => { setSemester(v); setModule("ALL"); }}><SelectTrigger aria-label="Semester" className="h-11 rounded-xl border-emerald-200 bg-background text-base font-bold text-foreground shadow-sm focus:ring-emerald-400 dark:border-emerald-800"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All semesters</SelectItem>{semesters.map((v) => <SelectItem key={v} value={String(v)}>SEMESTER {String(v).padStart(2,"0")}</SelectItem>)}</SelectContent></Select></div>
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-background to-background p-4 shadow-sm transition-shadow hover:shadow-md dark:border-amber-900 dark:from-amber-950/40 space-y-3"><div className="mb-1"><Label className="block text-sm font-extrabold tracking-tight text-amber-800 dark:text-amber-200">Skill / Module</Label><p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Skill selection</p></div><Select value={module} onValueChange={setModule}><SelectTrigger aria-label="Skill / Module" className="h-11 rounded-xl border-amber-200 bg-background text-base font-bold text-foreground shadow-sm focus:ring-amber-400 dark:border-amber-800"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All skills</SelectItem>{visibleModules.map((v) => <SelectItem key={`${v.semester}|${v.courseName}|${v.name}`} value={`${v.semester}|${v.courseName}|${v.name}`}>{v.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </CardContent>
    </Card>
    {error && <div role="alert" className="mb-4 flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertCircle className="h-4 w-4 shrink-0 text-destructive" />{error}</div>}
    {message && <div role="status" className="mb-4 flex gap-2 rounded-md border p-3 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</div>}
    {importDataProblem && <div role="alert" className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-4 font-semibold text-rose-900">Some CSV imports are incomplete. Reports are hidden until the database is repaired and verified.</div>}
    {wrongCurriculum && <div role="alert" className="sas-warning mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><p className="font-bold">Please select the correct curriculum.</p><p className="mt-1 text-sm font-normal">This student has records for {studentCurricula.join(", ")}, not {curriculum}. No report is shown for the incorrect curriculum.</p></div>}
    {filterHasNoData && <div role="status" className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm dark:border-sky-900 dark:bg-sky-950/30">No matching student records for the selected course, semester or skill. Try a different filter.</div>}
    {rows.length > 0 && !importDataProblem && !wrongCurriculum && !filterHasNoData && <>
      <div className="mb-3"><h2 className="text-xl font-semibold tracking-tight">03 · Student report</h2><p className="mt-1 text-sm text-muted-foreground">Recorded sessions, missing numbers and coverage.</p></div>
      <Card className="sas-panel mb-5"><CardContent className="grid gap-4 p-4 sm:grid-cols-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Student</p><p className="mt-1 font-semibold">{rows[0]?.studentName}</p><p className="font-mono text-sm">{studentId}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Curriculum details</p><p className="text-xl font-semibold">{[...new Set(studentRows.map((r) => curriculumFrom(r.courseCode)).filter(Boolean))].join(", ") || "Not identified"}</p><p className="text-xs text-muted-foreground">CSV course field: {[...new Set(studentRows.map((r) => r.courseName).filter(Boolean))].join(", ") || "—"}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Selected skills</p><p className="text-2xl font-bold">{displayedDetails.length}</p><p className="text-xs text-muted-foreground">{displayedDetails.reduce((n,d) => n+d.missing.length,0)} session numbers missing from CSV</p></div>
      </CardContent></Card>
      <div className="sas-metrics mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/20"><p className="text-xs font-bold uppercase text-indigo-700 dark:text-indigo-300">Selected curriculum</p><p className="text-2xl font-extrabold">{curriculum}</p><p className="text-xs text-muted-foreground">Filtered to this curriculum</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"><p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">Recorded sessions</p><p className="text-2xl font-extrabold">{displayedDetails.reduce((n,d) => n+d.marked.length,0)}</p><p className="text-xs text-muted-foreground">Unique sessions found</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900 dark:bg-rose-950/20"><p className="text-xs font-bold uppercase text-rose-700 dark:text-rose-300">Missing numbers</p><p className="text-2xl font-extrabold">{displayedDetails.reduce((n,d) => n+d.missing.length,0)}</p><p className="text-xs text-muted-foreground">Missing from CSV</p></div>
      </div>
      <div className="sas-skill-results space-y-4">
        {displayedDetails.map((item) => <Card key={`${item.curriculumCode}-${item.semester}-${item.courseName}-${item.name}`}>
          <CardHeader className="pb-3"><CardTitle className="flex flex-wrap items-center gap-2 text-base"><span>{item.name}</span><span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{item.code}</span></CardTitle>{item.portalName && <div className="mt-2 grid gap-2 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/20 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">CPC skill name</p><p className="font-normal">{item.name}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Portal / CSV skill name</p><p className="font-normal">{item.portalName}</p></div></div>}<p className="text-sm text-muted-foreground">Curriculum {item.curriculumCode} <span aria-hidden="true">·</span> {item.courseName} <span aria-hidden="true">·</span> Semester {String(item.semester).padStart(2,"0")}</p></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Skill progress</p>
                <p className={`text-lg font-bold tabular-nums ${item.percentage > 75 ? "text-emerald-600" : "text-red-600"}`}>{item.portalPending ? "N/A" : `${item.percentage}%`}</p>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${item.name} record coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.portalPending ? 0 : Math.min(100, item.percentage)}>
                <div className={`h-full rounded-full transition-all ${item.percentage > 75 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${item.portalPending ? 0 : Math.min(100, item.percentage)}%` }} />
              </div>
              <p className={`text-xs font-medium ${item.percentage > 75 ? "text-emerald-600" : "text-red-600"}`}>{item.portalPending ? "Sessions not yet available on portal" : item.percentage > 75 ? "Above 75% · Good coverage" : "75% or below · Review records"}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Planned sessions</p><p className="text-xl font-semibold">{item.totalSessions}</p></div>
              <div className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Recorded session numbers</p><p className="text-xl font-semibold">{item.marked.length} / {item.totalSessions}</p></div>
              <div className="rounded-md bg-muted/50 p-3"><p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarCheck className="h-3.5 w-3.5" /> Missing numbers</p><p className="text-xl font-semibold">{item.portalPending ? "N/A" : item.missing.length}</p></div>
              <div className="rounded-md bg-muted/50 p-3"><p className="flex items-center gap-1 text-xs text-muted-foreground"><Percent className="h-3.5 w-3.5" /> Record coverage</p><p className="text-xl font-semibold">{item.portalPending ? "N/A" : `${item.percentage}%`}</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-sm font-semibold">Recorded session numbers</p><p className="rounded-lg bg-emerald-50 p-3 text-sm font-normal text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{item.marked.length ? item.marked.map(n => `#${n}`).join("  ·  ") : "None"}</p></div><div><p className="mb-1 text-sm font-semibold">Not found in uploaded CSV</p><p className={item.missing.length ? "rounded-lg bg-rose-50 p-3 text-sm font-normal text-rose-800 dark:bg-rose-950/30 dark:text-rose-200" : "rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"}>{item.portalPending ? "Sessions not added on portal" : item.missing.length ? item.missing.map(n => `#${n}`).join("  ·  ") : "No missing session numbers"}</p></div></div>
            {item.matched.length > 0 && <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Session #</TableHead><TableHead>Source session name</TableHead><TableHead>Date</TableHead><TableHead>Source term</TableHead></TableRow></TableHeader><TableBody>{item.matched.slice().sort((a,b) => a.sessionSequence-b.sessionSequence).map((r,i) => <TableRow key={`${r.sessionName}-${r.attendanceDate}-${i}`}><TableCell>{r.sessionSequence}</TableCell><TableCell>{r.sessionName}</TableCell><TableCell>{r.attendanceDate}</TableCell><TableCell>{r.termName}</TableCell></TableRow>)}</TableBody></Table></div>}
            {item.matched.length === 0 && <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">No matching CSV records for this skill and student. This does not confirm absence.</p>}
          </CardContent>
        </Card>)}
        {displayedDetails.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No skills match these filters.</CardContent></Card>}

      </div>
    </>}
    <footer className="sas-footer mt-10 border-t py-5 text-center text-xs font-normal text-muted-foreground">© Aptech Attendance Management System</footer>
  </div>;
}
