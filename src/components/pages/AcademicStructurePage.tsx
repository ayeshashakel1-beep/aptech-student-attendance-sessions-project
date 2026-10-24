import { useState } from "react";
import { Network, Plus, Trash2, DownloadCloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LocalNotice, PageHeader, StructurePicker, emptySelection } from "@/components/shared";
import { uid, useStore } from "@/lib/store";
import { ACADEMIC_CATALOG } from "@/lib/academicCatalog";
import { toast } from "sonner";

type Item = { id: string; name: string };

function LevelCard({ title, items, parentLabel, canAdd, onAdd, onRemove }: {
  title: string; items: Item[]; parentLabel: string | null; canAdd: boolean;
  onAdd: (name: string) => void; onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const submit = () => { const n = name.trim(); if (!n) return; onAdd(n); setName(""); };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{parentLabel ?? "Top level"}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Input aria-label={`New ${title}`} placeholder={canAdd ? `Add ${title.toLowerCase()}` : "Select parent above"} value={name} onChange={(e) => setName(e.target.value)} disabled={!canAdd} />
          <Button type="submit" size="icon" disabled={!canAdd || !name.trim()} aria-label={`Add ${title}`}><Plus /></Button>
        </form>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">None configured.</p> : (
          <ul className="divide-y rounded-md border">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{i.name}</span>
                <Button variant="ghost" size="icon" aria-label={`Remove ${i.name}`} onClick={() => onRemove(i.id)}><Trash2 className="text-destructive" /></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AcademicStructurePage() {
  const s = useStore();
  const [sel, setSel] = useState(emptySelection);
  const courses = s.courses.filter((c) => c.curriculumId === sel.curriculumId);
  const semesters = s.semesters.filter((x) => x.courseId === sel.courseId);
  const modules = s.modules.filter((m) => m.semesterId === sel.semesterId);
  const name = (list: Item[], id: string) => list.find((x) => x.id === id)?.name;

  const loadProvidedCatalog = () => {
    if (s.curricula.length || s.courses.length || s.semesters.length || s.modules.length) {
      toast.error("Default structure sirf empty academic structure mein load ho sakta hai. Existing structure ko overwrite nahi kiya.");
      return;
    }
    const curriculumCodes = [...new Set(ACADEMIC_CATALOG.map((m) => m.curriculumCode))];
    const curricula = curriculumCodes.map((code) => ({ id: `curriculum-${code}`, name: `Curriculum ${code}` }));
    const courseKeys = [...new Set(ACADEMIC_CATALOG.map((m) => `${m.curriculumCode}|${m.courseName}`))];
    const courses = courseKeys.map((key) => {
      const [code, courseName] = key.split("|");
      return { id: `course-${code}-${courseName!.replace(/\s+/g, "-")}`, name: courseName!, curriculumId: `curriculum-${code}` };
    });
    const semesterKeys = [...new Set(ACADEMIC_CATALOG.map((m) => `${m.curriculumCode}|${m.courseName}|${m.semester}`))];
    const semesters = semesterKeys.map((key) => {
      const [code, courseName, semester] = key.split("|");
      return { id: `semester-${code}-${courseName!.replace(/\s+/g, "-")}-${semester}`, name: `SEMESTER ${String(semester).padStart(2, "0")}`, courseId: `course-${code}-${courseName!.replace(/\s+/g, "-")}` };
    });
    const modules = ACADEMIC_CATALOG.map((m, i) => ({ id: `module-${m.curriculumCode}-${m.semester}-${i + 1}`, name: m.name, semesterId: `semester-${m.curriculumCode}-${m.courseName.replace(/\s+/g, "-")}-${m.semester}` }));
    const sessions = ACADEMIC_CATALOG.flatMap((m, i) => Array.from({ length: m.totalSessions }, (_, n) => ({ id: `session-${m.curriculumCode}-${m.semester}-${i + 1}-${n + 1}`, moduleId: modules[i]!.id, number: n + 1, title: "", date: "", status: "scheduled" as const })));
    s.setCurricula(() => curricula);
    s.setCourses(() => courses);
    s.setSemesters(() => semesters);
    s.setModules(() => modules);
    s.setSessions(() => sessions);
    toast.success(`Loaded ${curricula.length} curricula, ${courses.length} courses, ${semesters.length} semesters, ${modules.length} modules and ${sessions.length} planned sessions.`);
  };

  return (
    <div>
      <PageHeader title="Academic Structure" description="Your supplied curriculum, course, semester, module and planned session totals load automatically on first launch." actions={<Button variant="outline" onClick={loadProvidedCatalog} disabled={s.curricula.length > 0 || !s.backendReady}><DownloadCloud className="mr-2 h-4 w-4" /> {s.curricula.length > 0 ? "Structure already loaded" : "Load supplied structure"}</Button>} />
      <LocalNotice />
      <Card className="mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-base">Current selection</CardTitle></CardHeader>
        <CardContent><StructurePicker value={sel} onChange={setSel} /></CardContent>
      </Card>
      {s.curricula.length === 0 && (
        <div className="mb-6"><EmptyState icon={Network} title="No academic structure yet">Use “Load supplied structure” above to load the 7144 and 7062 curriculum/module session counts you provided, or add your own structure below.</EmptyState></div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LevelCard title="Curriculum" items={s.curricula} parentLabel={null} canAdd
          onAdd={(n) => s.setCurricula((p) => [...p, { id: uid(), name: n }])}
          onRemove={(id) => s.setCurricula((p) => p.filter((x) => x.id !== id))} />
        <LevelCard title="Course" items={courses} parentLabel={sel.curriculumId ? `In ${name(s.curricula, sel.curriculumId)}` : "Select a curriculum"} canAdd={!!sel.curriculumId}
          onAdd={(n) => s.setCourses((p) => [...p, { id: uid(), name: n, curriculumId: sel.curriculumId }])}
          onRemove={(id) => s.setCourses((p) => p.filter((x) => x.id !== id))} />
        <LevelCard title="Semester" items={semesters} parentLabel={sel.courseId ? `In ${name(s.courses, sel.courseId)}` : "Select a course"} canAdd={!!sel.courseId}
          onAdd={(n) => s.setSemesters((p) => [...p, { id: uid(), name: n, courseId: sel.courseId }])}
          onRemove={(id) => s.setSemesters((p) => p.filter((x) => x.id !== id))} />
        <LevelCard title="Module" items={modules} parentLabel={sel.semesterId ? `In ${name(s.semesters, sel.semesterId)}` : "Select a semester"} canAdd={!!sel.semesterId}
          onAdd={(n) => s.setModules((p) => [...p, { id: uid(), name: n, semesterId: sel.semesterId }])}
          onRemove={(id) => s.setModules((p) => p.filter((x) => x.id !== id))} />
      </div>
    </div>
  );
}
