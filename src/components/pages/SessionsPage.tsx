import { useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LocalNotice, PageHeader, StructurePicker, emptySelection } from "@/components/shared";
import { statusFor } from "@/lib/attendance";
import { uid, useStore } from "@/lib/store";
import type { ClassSession, SessionStatus } from "@/lib/types";

const STATUS_BADGE: Record<SessionStatus, string> = {
  completed: "bg-status-present/15 text-status-present border-status-present/30",
  scheduled: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<SessionStatus, string> = { completed: "Completed", scheduled: "Pending", cancelled: "Cancelled" };

export function SessionsPage() {
  const { sessions, setSessions, students, records, setRecords } = useStore();
  const [sel, setSel] = useState(emptySelection);
  const [edit, setEdit] = useState<ClassSession | null>(null);
  const [error, setError] = useState("");

  const list = sessions.filter((s) => s.moduleId === sel.moduleId).sort((a, b) => a.number - b.number);
  const roster = students.filter((s) => s.semesterId === sel.semesterId);

  const save = () => {
    if (!edit) return;
    if (!Number.isInteger(edit.number) || edit.number < 1) return setError("Session number must be a positive whole number.");
    if (sessions.some((s) => s.moduleId === edit.moduleId && s.number === edit.number && s.id !== edit.id)) return setError(`Session ${edit.number} already exists for this module.`);
    setSessions((p) => (p.some((s) => s.id === edit.id) ? p.map((s) => (s.id === edit.id ? edit : s)) : [...p, edit]));
    setEdit(null);
  };

  return (
    <div>
      <PageHeader title="Attendance Sessions" description="Sessions are added per module — no fixed number is assumed."
        actions={<Button disabled={!sel.moduleId} onClick={() => { setError(""); setEdit({ id: uid(), moduleId: sel.moduleId, number: (list.at(-1)?.number ?? 0) + 1, title: "", date: "", status: "scheduled" }); }}><Plus /> Add session</Button>} />
      <LocalNotice />
      <Card className="mb-4"><CardContent className="p-4"><StructurePicker value={sel} onChange={setSel} /></CardContent></Card>

      {!sel.moduleId ? <EmptyState icon={CalendarDays} title="Select a module">Choose a curriculum, course, semester and module to view its sessions.</EmptyState>
        : list.length === 0 ? <EmptyState icon={CalendarDays} title="No sessions for this module">Add sessions manually or create them from a CSV import.</EmptyState>
        : (
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>#</TableHead><TableHead>Title</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Present</TableHead><TableHead className="text-right">Absent</TableHead><TableHead className="text-right">Unmarked</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>{list.map((s) => {
              const st = roster.map((r) => statusFor(records, s.id, r.studentId));
              return (
                <TableRow key={s.id} className={s.status === "completed" ? "" : "bg-muted/30"}>
                  <TableCell className="font-mono">{s.number}</TableCell>
                  <TableCell>{s.title || <span className="text-muted-foreground">Untitled</span>}</TableCell>
                  <TableCell>{s.date || <span className="text-muted-foreground">Not set</span>}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_BADGE[s.status]}>{STATUS_LABEL[s.status]}</Badge></TableCell>
                  <TableCell className="text-right">{st.filter((x) => x === "present").length}</TableCell>
                  <TableCell className="text-right">{st.filter((x) => x === "absent").length}</TableCell>
                  <TableCell className="text-right">{st.filter((x) => x === "unmarked").length}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit session ${s.number}`} onClick={() => { setError(""); setEdit(s); }}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete session ${s.number}`} onClick={() => {
                      if (!window.confirm(`Delete session ${s.number} and its attendance marks?`)) return;
                      setSessions((p) => p.filter((x) => x.id !== s.id));
                      setRecords((p) => p.filter((r) => r.sessionId !== s.id));
                    }}><Trash2 className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table></Card>
        )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Session details</DialogTitle></DialogHeader>
          {edit && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="snum">Session number</Label><Input id="snum" type="number" min={1} value={edit.number} onChange={(e) => setEdit({ ...edit, number: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label htmlFor="sdate">Date</Label><Input id="sdate" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="stitle">Title</Label><Input id="stitle" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v as SessionStatus })}>
                  <SelectTrigger aria-label="Session status"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(STATUS_LABEL) as SessionStatus[]).map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <DialogFooter><Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
