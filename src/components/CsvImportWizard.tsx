import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileUp, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StructurePicker, downloadText, emptySelection } from "@/components/shared";
import { findSession, parseCsv, rejectedToCsv, validate, type Mapping, type ParsedCsv } from "@/lib/csvImport";
import { uid, useStore } from "@/lib/store";
import type { AttendanceRecord, ClassSession, ImportRecord } from "@/lib/types";

const blankMap: Mapping = { format: "long", studentCol: "", bcCol: "", sessionCol: "", sessionKey: "number", statusCol: "", matrixCols: [] };

export function CsvImportWizard({ replacing, onDone }: { replacing?: ImportRecord; onDone?: () => void }) {
  const store = useStore();
  const [sel, setSel] = useState(replacing?.structure ?? emptySelection);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [map, setMap] = useState<Mapping>(blankMap);
  const [createSessions, setCreateSessions] = useState(false);
  const [conflictMode, setConflictMode] = useState<"skip" | "overwrite">("skip");
  const [removeOld, setRemoveOld] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return void toast.error("Please choose a .csv file.");
    const text = await f.text();
    const p = parseCsv(text);
    setFile({ name: f.name, text }); setParsed(p); setMap(blankMap);
    if (p.headers.length === 0) toast.error("No header row found in this file.");
  };

  const moduleSessions = store.sessions.filter((s) => s.moduleId === sel.moduleId);
  const existing = replacing && removeOld ? store.records.filter((r) => r.importId !== replacing.id) : store.records;
  const mappingReady = !!map.studentCol && (map.format === "long" ? !!map.sessionCol && !!map.statusCol : map.format === "matrix" ? map.matrixCols.length > 0 : false);

  const result = useMemo(() => (parsed && sel.moduleId && mappingReady
    ? validate(parsed, map, store.students.filter((s) => s.semesterId === sel.semesterId), moduleSessions, existing, createSessions)
    : null), [parsed, map, sel, store.students, moduleSessions, existing, createSessions, mappingReady]);

  const conflictKeys = new Set(result?.conflicts.map((c) => c.rowNumber + c.studentId + (c.sessionNumber ?? c.date)) ?? []);
  const toWrite = result?.valid.filter((m) => m.status !== "unmarked" && (conflictMode === "overwrite" || !conflictKeys.has(m.rowNumber + m.studentId + (m.sessionNumber ?? m.date)))) ?? [];

  const apply = () => {
    if (!result || !file) return;
    const importId = uid();
    let sessions = store.sessions;
    const newSessions: ClassSession[] = [];
    if (createSessions) {
      for (const ms of result.missingSessions) {
        const all = [...moduleSessions, ...newSessions];
        const number = ms.number ?? Math.max(0, ...all.map((s) => s.number)) + 1;
        newSessions.push({ id: uid(), moduleId: sel.moduleId, number, title: "", date: ms.date, status: "completed" });
      }
      sessions = [...sessions, ...newSessions];
      store.setSessions(() => sessions);
    }
    const modSess = sessions.filter((s) => s.moduleId === sel.moduleId);
    const recs: AttendanceRecord[] = toWrite.flatMap((m) => {
      const s = findSession(modSess, m);
      return s ? [{ sessionId: s.id, studentId: m.studentId, status: m.status as AttendanceRecord["status"], importId }] : [];
    });
    store.setRecords((prev) => {
      let base = replacing && removeOld ? prev.filter((r) => r.importId !== replacing.id) : prev;
      const keys = new Set(recs.map((r) => r.sessionId + "|" + r.studentId));
      base = base.filter((r) => !keys.has(r.sessionId + "|" + r.studentId));
      return [...base, ...recs];
    });
    const rec: ImportRecord = {
      id: importId, filename: file.name, uploadedAt: new Date().toISOString(), structure: sel,
      totalRows: result.totalRows, importedRows: recs.length, rejectedRows: result.rejected.length,
      status: "applied", rawText: file.text, rejected: result.rejected,
    };
    store.setImports((p) => [rec, ...(replacing ? p.filter((x) => x.id !== replacing.id) : p)]);
    toast.success(`${recs.length} attendance mark(s) applied. Saving to the local database.`);
    setFile(null); setParsed(null); setConfirmOpen(false);
    onDone?.();
  };

  const colSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}><SelectValue placeholder="Choose column" /></SelectTrigger>
        <SelectContent>{parsed?.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">1. Academic structure</CardTitle></CardHeader>
        <CardContent>
          {replacing ? <p className="text-sm text-muted-foreground">Replacing <span className="font-medium text-foreground">{replacing.filename}</span> — same structure is used.</p>
            : <StructurePicker value={sel} onChange={setSel} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">2. Choose CSV file</CardTitle></CardHeader>
        <CardContent>
          <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]); }}
            className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${drag ? "border-primary bg-accent" : "border-border hover:bg-muted/40"}`}>
            <FileUp className="mb-2 h-8 w-8 text-primary" />
            <p className="font-medium">{file ? file.name : "Drop a CSV file here or click to browse"}</p>
            <p className="text-sm text-muted-foreground">{parsed ? `${parsed.rows.length} rows · ${parsed.headers.length} columns` : "The file is read in your browser only."}</p>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {parsed && parsed.errors.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm text-destructive">{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          )}
        </CardContent>
      </Card>

      {parsed && parsed.headers.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">3. Preview (first 10 rows)</CardTitle></CardHeader>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>{parsed.headers.map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{parsed.rows.slice(0, 10).map((r, i) => <TableRow key={i}>{parsed.headers.map((h) => <TableCell key={h} className="whitespace-nowrap font-mono text-xs">{r[h]}</TableCell>)}</TableRow>)}</TableBody>
            </Table></div>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">4. Column mapping</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={map.format} onValueChange={(v) => setMap({ ...blankMap, format: v as Mapping["format"] })} className="grid gap-2 sm:grid-cols-3">
                {([
                  ["long", "Date-wise rows", "One row per student per session"],
                  ["matrix", "Session columns", "One row per student, one column per session"],
                  ["summary", "Summary totals", "Totals per student (preview only)"],
                ] as const).map(([v, t, d]) => (
                  <Label key={v} htmlFor={`fmt-${v}`} className="flex cursor-pointer items-start gap-2 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
                    <RadioGroupItem id={`fmt-${v}`} value={v} className="mt-0.5" />
                    <span><span className="block font-medium">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                  </Label>
                ))}
              </RadioGroup>
              {map.format === "summary" ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Summary files contain totals rather than per-session marks, so they cannot be imported as attendance records in this phase. The final handling will be decided after reviewing your original CSV.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {colSelect("Student ID column", map.studentCol, (v) => setMap({ ...map, studentCol: v }))}
                  {colSelect("BC Number column (optional check)", map.bcCol, (v) => setMap({ ...map, bcCol: v, matrixCols: map.matrixCols.filter((col) => col !== v) }))}
                  {map.format === "long" && <>
                    {colSelect("Session column", map.sessionCol, (v) => setMap({ ...map, sessionCol: v }))}
                    <div className="space-y-1.5"><Label>Session column contains</Label>
                      <Select value={map.sessionKey} onValueChange={(v) => setMap({ ...map, sessionKey: v as Mapping["sessionKey"] })}>
                        <SelectTrigger aria-label="Session column contains"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="number">Session number</SelectItem><SelectItem value="date">Session date</SelectItem></SelectContent>
                      </Select></div>
                    {colSelect("Status column", map.statusCol, (v) => setMap({ ...map, statusCol: v }))}
                  </>}
                </div>
              )}
              {map.format === "matrix" && (
                <div>
                  <Label>Session columns (in order; first ticked = session 1)</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {parsed.headers.filter((h) => h !== map.studentCol && h !== map.bcCol).map((h) => (
                      <label key={h} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={map.matrixCols.includes(h)} onCheckedChange={(c) => setMap({ ...map, matrixCols: c ? parsed.headers.filter((x) => x === h || map.matrixCols.includes(x)) : map.matrixCols.filter((x) => x !== h) })} />
                        {h}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">If your CSV includes a BC Number column, map it to verify each row matches the student record. Recognised status values: P / Present / 1, A / Absent / 0, L / Late, E / Excused. Blank cells are treated as unmarked.</p>
            </CardContent>
          </Card>

          {!sel.moduleId && <p className="text-sm text-warning">Select a module in step 1 to validate.</p>}

          {result && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">5. Validation</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Stat label="Rows in file" value={result.totalRows} />
                  <Stat label="Valid marks" value={result.valid.length} icon={<CheckCircle2 className="h-4 w-4 text-status-present" />} />
                  <Stat label="Rejected" value={result.rejected.length} icon={<XCircle className="h-4 w-4 text-destructive" />} />
                  <Stat label="Duplicates" value={result.duplicates} />
                  <Stat label="Conflicts with existing" value={result.conflicts.length} icon={<AlertTriangle className="h-4 w-4 text-warning" />} />
                </div>
                {result.unknownStudentIds.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium text-destructive">Unknown student IDs ({result.unknownStudentIds.length})</p>
                    <p className="mt-1 break-words font-mono text-xs">{result.unknownStudentIds.slice(0, 50).join(", ")}{result.unknownStudentIds.length > 50 ? " …" : ""}</p>
                  </div>
                )}
                {result.missingSessions.length > 0 && (
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <Checkbox checked={createSessions} onCheckedChange={(c) => setCreateSessions(!!c)} className="mt-0.5" />
                    <span>Create {result.missingSessions.length} missing session(s) for this module from the file. Otherwise those rows are rejected.</span>
                  </label>
                )}
                {result.conflicts.length > 0 && (
                  <RadioGroup value={conflictMode} onValueChange={(v) => setConflictMode(v as "skip" | "overwrite")} className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                    <p className="font-medium">{result.conflicts.length} mark(s) differ from existing attendance. Choose how to handle them:</p>
                    <label className="flex items-center gap-2"><RadioGroupItem value="skip" /> Keep existing marks (skip conflicting rows)</label>
                    <label className="flex items-center gap-2"><RadioGroupItem value="overwrite" /> Replace existing marks with values from this file</label>
                  </RadioGroup>
                )}
                {replacing && (
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <Checkbox checked={removeOld} onCheckedChange={(c) => setRemoveOld(!!c)} className="mt-0.5" />
                    <span>Remove attendance created by the previous file before applying this one. Records from other imports and manual marking are kept.</span>
                  </label>
                )}
                {result.rejected.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Invalid rows</p>
                      <Button variant="outline" size="sm" onClick={() => downloadText(`rejected-${file?.name ?? "rows.csv"}`, rejectedToCsv(result.rejected))}><Download /> Rejected rows CSV</Button>
                    </div>
                    <div className="max-h-64 overflow-auto rounded-md border"><Table>
                      <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                      <TableBody>{result.rejected.slice(0, 200).map((r, i) => <TableRow key={i}><TableCell className="font-mono">{r.rowNumber}</TableCell><TableCell>{r.reason}</TableCell></TableRow>)}</TableBody>
                    </Table></div>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 border-t pt-4">
                  <span className="text-sm text-muted-foreground">{toWrite.length} mark(s) will be applied</span>
                  <Button disabled={toWrite.length === 0} onClick={() => setConfirmOpen(true)}>Review & confirm import</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this import?</AlertDialogTitle>
            <AlertDialogDescription>
              {toWrite.length} attendance mark(s) from {file?.name} will be applied
              {result?.conflicts.length ? (conflictMode === "overwrite" ? `, replacing ${result.conflicts.length} existing mark(s)` : `, skipping ${result.conflicts.length} conflicting mark(s)`) : ""}.
              The import will be saved to the local database on this computer. Keep the backend running while using the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={apply}>Apply import</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="font-display text-xl font-semibold">{value}</p>
    </div>
  );
}
