import { useState } from "react";
import { BarChart3, Download } from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge, StructurePicker, downloadText, emptySelection } from "@/components/shared";
import { statusFor, summarize } from "@/lib/attendance";
import { useStore } from "@/lib/store";

const RULE_TEXT = { present: "counted as present", absent: "counted as absent", exclude: "excluded" } as const;

export function ReportsPage() {
  const { sessions, students, records, rules } = useStore();
  const [sel, setSel] = useState(emptySelection);
  const [sid, setSid] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const inRange = (d: string) => (!from || (d && d >= from)) && (!to || (d && d <= to));
  const mSessions = sessions.filter((s) => s.moduleId === sel.moduleId && inRange(s.date)).sort((a, b) => a.number - b.number);
  const roster = students.filter((s) => s.semesterId === sel.semesterId && (!sid.trim() || s.studentId.toLowerCase().includes(sid.trim().toLowerCase()) || (s.bcNumber ?? "").toLowerCase().includes(sid.trim().toLowerCase())));
  const rows = roster.map((s) => ({ s, sum: summarize(mSessions, records, s.studentId, rules) }));

  const exportCsv = () => downloadText("attendance-report.csv", Papa.unparse(rows.map(({ s, sum }) => ({
    "Student ID": s.studentId, "BC Number": s.bcNumber ?? "", "Student Name": s.name, "Total Scheduled": sum.totalScheduled, Completed: sum.completed,
    Present: sum.present, Absent: sum.absent, Late: sum.late, Excused: sum.excused, Unmarked: sum.unmarked,
    "Attendance %": sum.percentage ?? "Not available",
  }))));

  return (
    <div>
      <PageHeader title="Attendance Reports" description={`Late marks are ${RULE_TEXT[rules.late]}; excused marks are ${RULE_TEXT[rules.excused]}. Unmarked sessions are excluded. Change rules in Settings.`}
        actions={<Button variant="outline" disabled={rows.length === 0} onClick={exportCsv}><Download /> Export CSV</Button>} />
      <Card className="mb-4"><CardContent className="space-y-4 p-4">
        <StructurePicker value={sel} onChange={setSel} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="rsid">Student ID or BC Number</Label><Input id="rsid" className="font-mono" value={sid} onChange={(e) => setSid(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="rfrom">From</Label><Input id="rfrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="rto">To</Label><Input id="rto" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </CardContent></Card>

      {!sel.moduleId ? <EmptyState icon={BarChart3} title="Select a module">Reports are generated from real sessions and attendance for one module.</EmptyState>
        : rows.length === 0 ? <EmptyState icon={BarChart3} title="No students to report">No students match this semester and filter.</EmptyState>
        : (
          <div className="space-y-6">
            <Card><Table>
              <TableHeader><TableRow>
                <TableHead>Student ID</TableHead><TableHead>BC Number</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Scheduled</TableHead><TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Present</TableHead><TableHead className="text-right">Absent</TableHead><TableHead className="text-right">Late</TableHead>
                <TableHead className="text-right">Excused</TableHead><TableHead className="text-right">Unmarked</TableHead><TableHead className="text-right">Attendance</TableHead>
              </TableRow></TableHeader>
              <TableBody>{rows.map(({ s, sum }) => (
                <TableRow key={s.studentId}>
                  <TableCell className="font-mono">{s.studentId}</TableCell><TableCell className="font-mono">{s.bcNumber ?? <span className="text-muted-foreground">—</span>}</TableCell><TableCell>{s.name}</TableCell>
                  <TableCell className="text-right">{sum.totalScheduled}</TableCell><TableCell className="text-right">{sum.completed}</TableCell>
                  <TableCell className="text-right">{sum.present}</TableCell><TableCell className="text-right">{sum.absent}</TableCell>
                  <TableCell className="text-right">{sum.late}</TableCell><TableCell className="text-right">{sum.excused}</TableCell>
                  <TableCell className="text-right">{sum.unmarked}</TableCell>
                  <TableCell className={`text-right font-medium ${sum.percentage !== null && sum.percentage < rules.lowAttendanceThreshold ? "text-destructive" : ""}`}>
                    {sum.percentage === null ? <span className="text-muted-foreground">Not available</span> : `${sum.percentage}%`}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table></Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Session-wise matrix</CardTitle></CardHeader>
              {mSessions.length === 0 ? <CardContent><p className="text-sm text-muted-foreground">No sessions in this module or date range.</p></CardContent> : (
                <div className="overflow-x-auto"><Table>
                  <TableHeader><TableRow>
                    <TableHead className="sticky left-0 bg-card">Student</TableHead>
                    {mSessions.map((x) => <TableHead key={x.id} className="whitespace-nowrap text-center">S{x.number}<div className="text-xs font-normal">{x.date || "no date"}</div></TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>{rows.map(({ s }) => (
                    <TableRow key={s.studentId}>
                      <TableCell className="sticky left-0 bg-card font-mono">{s.studentId}</TableCell>
                      {mSessions.map((x) => <TableCell key={x.id} className="text-center"><StatusBadge status={statusFor(records, x.id, s.studentId)} /></TableCell>)}
                    </TableRow>
                  ))}</TableBody>
                </Table></div>
              )}
            </Card>
          </div>
        )}
    </div>
  );
}
