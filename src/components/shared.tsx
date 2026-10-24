import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import type { AttendanceStatus, StructureSelection } from "@/lib/types";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-accent p-3 text-primary"><Icon className="h-6 w-6" /></div>
      <p className="font-medium text-foreground">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function LocalNotice({ children }: { children?: ReactNode }) {
  const { backendReady, backendError } = useStore();
  const message = backendError
    ? `Local database error: ${backendError}. Check that the backend is running, then try again.`
    : children ?? (!backendReady
      ? "Connecting to the local database…"
      : "Connected to the local database. Changes are saved on this computer.");
  return (
    <div className={`mb-6 flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-foreground ${backendError ? "border-destructive/40 bg-destructive/5" : backendReady ? "border-status-present/30 bg-status-present/5" : "border-warning/40 bg-warning/10"}`}>
      <Info className={`mt-0.5 h-4 w-4 shrink-0 ${backendError ? "text-destructive" : backendReady ? "text-status-present" : "text-warning"}`} />
      <span>{message}</span>
    </div>
  );
}

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "bg-status-present/15 text-status-present border-status-present/30",
  absent: "bg-destructive/10 text-destructive border-destructive/30",
  late: "bg-warning/15 text-warning border-warning/30",
  excused: "bg-status-excused/15 text-status-excused border-status-excused/30",
  unmarked: "bg-muted text-muted-foreground border-border",
};
export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge variant="outline" className={`capitalize ${STATUS_STYLE[status]}`}>{status}</Badge>;
}

type Level = "curriculum" | "course" | "semester" | "module";

/** Dependent dropdowns. Changing a parent resets all children. */
export function StructurePicker({ value, onChange, levels = ["curriculum", "course", "semester", "module"] }: {
  value: StructureSelection;
  onChange: (v: StructureSelection) => void;
  levels?: Level[];
}) {
  const { curricula, courses, semesters, modules } = useStore();
  const opts: Record<Level, { id: string; name: string }[]> = {
    curriculum: curricula,
    course: courses.filter((c) => c.curriculumId === value.curriculumId),
    semester: semesters.filter((s) => s.courseId === value.courseId),
    module: modules.filter((m) => m.semesterId === value.semesterId),
  };
  const parentReady: Record<Level, boolean> = {
    curriculum: true, course: !!value.curriculumId, semester: !!value.courseId, module: !!value.semesterId,
  };
  const set = (level: Level, id: string) => {
    if (level === "curriculum") onChange({ curriculumId: id, courseId: "", semesterId: "", moduleId: "" });
    if (level === "course") onChange({ ...value, courseId: id, semesterId: "", moduleId: "" });
    if (level === "semester") onChange({ ...value, semesterId: id, moduleId: "" });
    if (level === "module") onChange({ ...value, moduleId: id });
  };
  const key = (l: Level) => `${l}Id` as keyof StructureSelection;

  // Clear selections that no longer exist (e.g. deleted in Academic Structure)
  useEffect(() => {
    for (const l of levels) {
      const v = value[key(l)];
      if (v && !opts[l].some((o) => o.id === v)) { set(l, ""); break; }
    }
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {levels.map((l) => (
        <div key={l} className="space-y-1.5">
          <Label className="capitalize">{l}</Label>
          <Select value={value[key(l)]} onValueChange={(v) => set(l, v)} disabled={!parentReady[l] || opts[l].length === 0}>
            <SelectTrigger aria-label={l}>
              <SelectValue placeholder={!parentReady[l] ? "Select parent first" : opts[l].length === 0 ? "None configured" : `Select ${l}`} />
            </SelectTrigger>
            <SelectContent>
              {opts[l].map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

export const emptySelection: StructureSelection = { curriculumId: "", courseId: "", semesterId: "", moduleId: "" };

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function ConfirmText({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}
