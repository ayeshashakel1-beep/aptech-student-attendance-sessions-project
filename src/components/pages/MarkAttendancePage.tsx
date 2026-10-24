import { useEffect, useState } from "react";
import { ClipboardCheck, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, LocalNotice, PageHeader, StatusBadge, StructurePicker, emptySelection } from "@/components/shared";
import { statusFor } from "@/lib/attendance";
import { useStore } from "@/lib/store";
import type { AttendanceStatus, Student } from "@/lib/types";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused", "unmarked"];

export function MarkAttendancePage() {
  const { sessions, setSessions, students, records, setRecords } = useStore();
  const [sel, setSel] = useState(emptySelection);
  const [sessionId, setSessionId] = useState("");
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [history, setHistory] = useState<Student | null>(null);

  const moduleSessions = sessions.filter((s) => s.moduleId === sel.moduleId).sort((a, b) => a.number - b.number);
  const session = moduleSessions.find((s) => s.id === sessionId);
  const roster = students.filter((s) => s.semesterId === sel.semesterId).sort((a, b) => a.studentId.localeCompare(b.studentId));

  useEffect(() => { if (sessionId && !session) setSessionId(""); }, [sessionId, session]);
  useEffect(() => {
    const d: Record<string, AttendanceStatus> = {};
    roster.forEach((s) => (d[s.studentId] = statusFor(records, sessionId, s.studentId)));
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sel.semesterId]);

  const changed = roster.filter((s) => draft[s.studentId] !== statusFor(records, sessionId, s.studentId));

  const apply = () => {
    if (!session) return;
    setRecords((prev) => {
      const ids = new Set(changed.map((c) => c.studentId));
      const kept = prev.filter((r) => !(r.sessionId === session.id && ids.has(r.studentId)));
      const added = changed.filter((c) => draft[c.studentId] !== "unmarked").map((c) => ({
        sessionId: session.id, studentId: c.studentId, status: draft[c.studentId] as Exclude<AttendanceStatus, "unmarked">,
      }));
      return [...kept, ...added];
    });
    toast.success(`${changed.length} attendance mark(s) updated. Saving to the local database.`);
  };

  return (
    <div>
      <PageHeader title="Mark Attendance" description="Unmarked students are not counted as absent." />
      <LocalNotice />
      <Card className="mb-4"><CardContent className="space-y-4 p-4">
        <StructurePicker value={sel} onChange={(v) => { setSel(v); setSessionId(""); }} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Session number</Label>
            <Select value={sessionId} onValueChange={setSessionId} disabled={moduleSessions.length === 0}>
              <SelectTrigger aria-label="Session"><SelectValue placeholder={!sel.moduleId ? "Select module first" : moduleSessions.length ? "Select session" : "No sessions configured"} /></SelectTrigger>
              <SelectContent>{moduleSessions.map((s) => <SelectItem key={s.id} value={s.id}>Session {s.number}{s.title ? ` — ${s.title}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mdate">Session date</Label>
            <Input id="mdate" type="date" disabled={!session} value={session?.date ?? ""}
              onChange={(e) => session && setSessions((p) => p.map((s) => (s.id === session.id ? { ...s, date: e.target.value } : s)))} />
          </div>
        </div>
      </CardContent></Card>

      {!session ? <EmptyState icon={ClipboardCheck} title="Select a session">Pick a module and one of its sessions. Add sessions on the Attendance Sessions page.</EmptyState>
        : roster.length === 0 ? <EmptyState icon={ClipboardCheck} title="No students in this semester">Add students to this curriculum, course and semester first.</EmptyState>
        : (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Session {session.number}{session.date ? ` · ${session.date}` : ""}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setDraft(Object.fromEntries(roster.map((s) => [s.studentId, "present"])))}>Mark all present</Button>
                <Button size="sm" disabled={changed.length === 0} onClick={() => {
                  if (window.confirm(`Apply ${changed.length} change(s) to session ${session.number}?`)) apply();
                }}>Apply {changed.length || ""} change{changed.length === 1 ? "" : "s"}</Button>
              </div>
            </CardHeader>
            <Table>
              <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="text-right">History</TableHead></TableRow></TableHeader>
              <TableBody>{roster.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell className="font-mono">{s.studentId}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    <ToggleGroup type="single" size="sm" variant="outline" value={draft[s.studentId] ?? "unmarked"}
                      onValueChange={(v) => v && setDraft((d) => ({ ...d, [s.studentId]: v as AttendanceStatus }))} className="flex-wrap justify-start">
                      {STATUSES.map((st) => <ToggleGroupItem key={st} value={st} className="capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{st}</ToggleGroupItem>)}
                    </ToggleGroup>
                  </TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" aria-label={`History for ${s.name}`} onClick={() => setHistory(s)}><History /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </Card>
        )}

      <Sheet open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>{history?.name} <span className="font-mono text-muted-foreground">{history?.studentId}</span></SheetTitle></SheetHeader>
          {history && (
            <ul className="mt-4 divide-y rounded-md border">
              {moduleSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>Session {s.number} · <span className="text-muted-foreground">{s.date || "date not set"}</span></span>
                  <StatusBadge status={statusFor(records, s.id, history.studentId)} />
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
