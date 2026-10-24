import { useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, LocalNotice, PageHeader, StructurePicker, emptySelection } from "@/components/shared";
import { useStore, useStructureNames } from "@/lib/store";
import type { Student } from "@/lib/types";

type Draft = { studentId: string; bcNumber: string; name: string; email: string; batch: string; curriculumId: string; courseId: string; semesterId: string; moduleId: string };
const blank: Draft = { studentId: "", bcNumber: "", name: "", email: "", batch: "", ...emptySelection };

export function StudentsPage() {
  const { students, setStudents, setRecords } = useStore();
  const names = useStructureNames();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(emptySelection);
  const [editing, setEditing] = useState<{ original: string | null; draft: Draft } | null>(null);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Student | null>(null);

  const rows = students.filter((s) => {
    const t = q.trim().toLowerCase();
    if (t && !s.studentId.toLowerCase().includes(t) && !(s.bcNumber ?? "").toLowerCase().includes(t) && !s.name.toLowerCase().includes(t) && !(s.email ?? "").toLowerCase().includes(t)) return false;
    if (filter.curriculumId && s.curriculumId !== filter.curriculumId) return false;
    if (filter.courseId && s.courseId !== filter.courseId) return false;
    if (filter.semesterId && s.semesterId !== filter.semesterId) return false;
    return true;
  });

  const save = () => {
    if (!editing) return;
    const d = editing.draft;
    const id = d.studentId.trim();
    const bc = d.bcNumber.trim();
    if (!id || !d.name.trim()) return setError("Student ID and name are required.");
    if (!d.curriculumId || !d.courseId || !d.semesterId) return setError("Select curriculum, course and semester.");
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) return setError("Email address looks invalid.");
    if (id !== editing.original && students.some((s) => s.studentId === id)) return setError(`Student ID ${id} already exists.`);
    if (bc && students.some((s) => s.studentId !== editing.original && (s.bcNumber ?? "").trim().toLowerCase() === bc.toLowerCase())) return setError(`BC Number ${bc} already belongs to another student.`);
    const student: Student = {
      studentId: id, bcNumber: bc, name: d.name.trim(), email: d.email.trim() || undefined, batch: d.batch.trim() || undefined,
      curriculumId: d.curriculumId, courseId: d.courseId, semesterId: d.semesterId,
    };
    setStudents((p) => editing.original ? p.map((s) => (s.studentId === editing.original ? student : s)) : [...p, student]);
    if (editing.original && editing.original !== id)
      setRecords((p) => p.map((r) => (r.studentId === editing.original ? { ...r, studentId: id } : r)));
    toast.success(editing.original ? "Student updated and saved to the local database." : "Student added and saved to the local database.");
    setEditing(null);
  };

  const setD = (patch: Partial<Draft>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } });

  return (
    <div>
      <PageHeader title="Students" description="Student ID is the main search key. BC Number is optional."
        actions={<Button onClick={() => { setError(""); setEditing({ original: null, draft: blank }); }}><Plus /> Add Student</Button>} />
      <LocalNotice />
      <Card className="mb-4"><CardContent className="space-y-4 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by ID, BC Number, name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
        </div>
        <StructurePicker value={filter} onChange={setFilter} levels={["curriculum", "course", "semester"]} />
      </CardContent></Card>

      {students.length === 0 ? (
        <EmptyState icon={Users} title="No students yet">Load the supplied academic structure first, then add a student. You can search students by Student ID; BC Number is optional.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={Search} title="No matching students">Try a different search or clear filters.</EmptyState>
      ) : (
        <Card><Table>
          <TableHeader><TableRow>
            <TableHead>Student ID</TableHead><TableHead>BC Number</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Batch</TableHead>
            <TableHead>Curriculum</TableHead><TableHead>Course</TableHead><TableHead>Semester</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>{rows.map((s) => (
            <TableRow key={s.studentId}>
              <TableCell className="font-mono">{s.studentId}</TableCell>
              <TableCell className="font-mono">{s.bcNumber ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell>{s.batch ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell>{names.curriculum(s.curriculumId)}</TableCell>
              <TableCell>{names.course(s.courseId)}</TableCell>
              <TableCell>{names.semester(s.semesterId)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => { setError(""); setEditing({ original: s.studentId, draft: { ...blank, ...s, bcNumber: s.bcNumber ?? "", email: s.email ?? "", batch: s.batch ?? "" } }); }}><Pencil /></Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => setToDelete(s)}><Trash2 className="text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.original ? "Edit student" : "Add student"}</DialogTitle></DialogHeader>
          {editing && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="sid">Student ID *</Label><Input id="sid" className="font-mono" value={editing.draft.studentId} onChange={(e) => setD({ studentId: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="sbc">BC Number (optional)</Label><Input id="sbc" className="font-mono" value={editing.draft.bcNumber} onChange={(e) => setD({ bcNumber: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="sname">Student name *</Label><Input id="sname" value={editing.draft.name} onChange={(e) => setD({ name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="semail">Email</Label><Input id="semail" type="email" value={editing.draft.email} onChange={(e) => setD({ email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="sbatch">Batch</Label><Input id="sbatch" value={editing.draft.batch} onChange={(e) => setD({ batch: e.target.value })} /></div>
              </div>
              <StructurePicker value={editing.draft} onChange={(v) => setD(v)} levels={["curriculum", "course", "semester"]} />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit">{editing.original ? "Save changes" : "Add student"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student {toDelete?.studentId}?</AlertDialogTitle>
            <AlertDialogDescription>This removes {toDelete?.name} and their attendance marks from this session.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (!toDelete) return;
              setStudents((p) => p.filter((s) => s.studentId !== toDelete.studentId));
              setRecords((p) => p.filter((r) => r.studentId !== toDelete.studentId));
              setToDelete(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
