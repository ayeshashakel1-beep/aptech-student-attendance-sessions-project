import { useEffect, useState } from "react";
import { Users, BookOpen, Database, Files, ArrowUpRight, ShieldCheck, FileSpreadsheet, Search, Layers3 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ACADEMIC_CATALOG } from "@/lib/academicCatalog";
import { readApiJson } from "@/lib/sessionUpload";

type Overview = { imports: number; rows: number; students: number };
export function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/session-log")
      .then(async response => {
        const body = await readApiJson(response);
        if (!response.ok) throw new Error(body.error || "Unable to load imports");
        if (active) setOverview({imports: (body.imports ?? []).length, rows: Number(body.uniqueRows ?? body.rows ?? 0), students: Number(body.students ?? 0)});
      })
      .catch(() => {if(active) setLoadError(true);});
    return () => { active = false; };
  }, []);
  const catalogs = ["7144", "7062"].map(code => ({code, skills: ACADEMIC_CATALOG.filter(item => item.curriculumCode === code).length}));
  const cards = [
    {label:"Imported CSV files", value: overview?.imports, icon:Files, color:"text-sky-700 dark:text-sky-300", bg:"bg-sky-50 dark:bg-sky-950/30"},
    {label:"Unique session records", value:overview?.rows, icon:Database, color:"text-violet-700 dark:text-violet-300", bg:"bg-violet-50 dark:bg-violet-950/30"},
    {label:"Students in CSVs", value:overview?.students, icon:Users, color:"text-emerald-700 dark:text-emerald-300", bg:"bg-emerald-50 dark:bg-emerald-950/30"},
    {label:"Approved skills", value:ACADEMIC_CATALOG.length, icon:BookOpen, color:"text-amber-700 dark:text-amber-300", bg:"bg-amber-50 dark:bg-amber-950/30"},
  ];
  return <div className="dashboard-modern mx-auto max-w-[1550px] space-y-6">
    <div className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:bg-card"><img src="/aptech-logo.png" alt="Aptech" className="h-14 w-32 object-contain"/><div><h1 className="text-xl font-extrabold tracking-tight">Aptech Attendance Management System</h1><p className="text-sm font-normal text-muted-foreground">Student session coverage and attendance records</p></div></div>
    <div className="rounded-3xl border border-indigo-200/60 bg-gradient-to-r from-indigo-700 via-blue-700 to-sky-600 p-6 text-white shadow-xl shadow-indigo-900/10 md:p-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div className="max-w-2xl space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide"><ShieldCheck className="h-4 w-4"/> APPROVED CURRICULUM TRACKING</div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Student Session Coverage</h2>
        <p className="text-sm leading-relaxed text-indigo-50">Track recorded and missing session numbers for curricula 7144 and 7062.</p>
      </div><Link to="/student-attendance-sessions" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-800 shadow-sm hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Open Session Reports <ArrowUpRight className="h-4 w-4"/></Link></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(c => <Card key={c.label} className="dashboard-kpi border-border/70"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm font-medium text-muted-foreground">{c.label}</p><p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{c.value == null ? "—" : c.value.toLocaleString()}</p></div><div className={`rounded-xl p-3 ${c.bg} ${c.color}`}><c.icon className="h-5 w-5"/></div></CardContent></Card>)}</div>
    {loadError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">CSV statistics are unavailable. Start the backend server to load live data.</p>}
    <div className="grid gap-4 lg:grid-cols-2"><Card className="dashboard-kpi"><CardContent className="p-6"><div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-indigo-600"/><h3 className="font-bold">Curriculum coverage</h3></div><div className="grid gap-3 sm:grid-cols-2">{catalogs.map(x=><div key={x.code} className="rounded-2xl border bg-muted/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Curriculum</p><p className="mt-1 text-3xl font-bold">{x.code}</p><p className="mt-2 text-sm text-muted-foreground">{x.skills} approved skills</p></div>)}</div></CardContent></Card>
    <Card className="dashboard-kpi"><CardContent className="p-6"><h3 className="mb-4 font-bold">Quick actions</h3><div className="space-y-3"><Link to="/student-attendance-sessions" className="flex items-center justify-between rounded-xl border p-4 hover:bg-accent"><span className="flex items-center gap-3 text-sm font-semibold"><FileSpreadsheet className="h-5 w-5 text-sky-600"/>Upload & manage CSV files</span><ArrowUpRight className="h-4 w-4"/></Link><Link to="/student-attendance-sessions" className="flex items-center justify-between rounded-xl border p-4 hover:bg-accent"><span className="flex items-center gap-3 text-sm font-semibold"><Search className="h-5 w-5 text-violet-600"/>Search student sessions</span><ArrowUpRight className="h-4 w-4"/></Link></div></CardContent></Card></div>
    
  </div>;
}
