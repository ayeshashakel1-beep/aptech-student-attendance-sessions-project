import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Eye, FileX, History, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, LocalNotice, PageHeader, downloadText } from "@/components/shared";
import { CsvImportWizard } from "@/components/CsvImportWizard";
import { parseCsv, rejectedToCsv } from "@/lib/csvImport";
import { useStore, useStructureNames } from "@/lib/store";
import type { ImportRecord } from "@/lib/types";

type Action = { kind: "preview" | "replace" | "deleteFile" | "deleteAttendance"; rec: ImportRecord } | null;

export function ImportHistoryPage() {
  const { imports, setImports, records, setRecords } = useStore();
  const names = useStructureNames();
  const [action, setAction] = useState<Action>(null);
  const close = () => setAction(null);
  const affected = action ? records.filter((r) => r.importId === action.rec.id).length : 0;

  return (
    <div>
      <PageHeader title="CSV Import History" description="Only files you have actually imported appear here." />
      <LocalNotice />
      {imports.length === 0 ? (
        <EmptyState icon={History} title="No imports yet">Files appear here after you confirm an import on the <Link to="/csv-import" className="text-primary underline">CSV Import</Link> page.</EmptyState>
      ) : (
        <Card><Table>
          <TableHeader><TableRow>
            <TableHead>File</TableHead><TableHead>Uploaded</TableHead><TableHead>Structure</TableHead>
            <TableHead className="text-right">Rows</TableHead><TableHead className="text-right">Imported</TableHead><TableHead className="text-right">Rejected</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>{imports.map((r) => {
            const live = records.filter((x) => x.importId === r.id).length;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.filename}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(r.uploadedAt).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{names.curriculum(r.structure.curriculumId)} › {names.course(r.structure.courseId)} › {names.semester(r.structure.semesterId)} › {names.module(r.structure.moduleId)}</TableCell>
                <TableCell className="text-right">{r.totalRows}</TableCell>
                <TableCell className="text-right">{r.importedRows}</TableCell>
                <TableCell className="text-right">{r.rejectedRows}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline">{r.rawText === null ? "File deleted" : "File kept"}</Badge>
                    <span className="text-xs text-muted-foreground">{live} mark(s) in use</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${r.filename}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={r.rawText === null} onClick={() => setAction({ kind: "preview", rec: r })}><Eye /> Preview CSV</DropdownMenuItem>
                      <DropdownMenuItem disabled={r.rawText === null} onClick={() => r.rawText && downloadText(r.filename, r.rawText)}><Download /> Download original CSV</DropdownMenuItem>
                      <DropdownMenuItem disabled={r.rejected.length === 0} onClick={() => downloadText(`errors-${r.filename}`, rejectedToCsv(r.rejected))}><Download /> Download error CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAction({ kind: "replace", rec: r })}><RefreshCw /> Replace CSV</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setAction({ kind: "deleteFile", rec: r })}><FileX /> Delete file</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" disabled={live === 0} onClick={() => setAction({ kind: "deleteAttendance", rec: r })}><Trash2 /> Delete imported attendance</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table></Card>
      )}

      <Dialog open={action?.kind === "preview"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{action?.rec.filename}</DialogTitle></DialogHeader>
          {action?.rec.rawText && (() => { const p = parseCsv(action.rec.rawText); return (
            <div className="max-h-[60vh] overflow-auto rounded-md border"><Table>
              <TableHeader><TableRow>{p.headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{p.rows.slice(0, 100).map((row, i) => <TableRow key={i}>{p.headers.map((h) => <TableCell key={h} className="font-mono text-xs">{row[h]}</TableCell>)}</TableRow>)}</TableBody>
            </Table></div>
          ); })()}
        </DialogContent>
      </Dialog>

      <Dialog open={action?.kind === "replace"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Replace {action?.rec.filename}</DialogTitle></DialogHeader>
          {action?.kind === "replace" && <CsvImportWizard replacing={action.rec} onDone={close} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={action?.kind === "deleteFile"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file {action?.rec.filename}?</AlertDialogTitle>
            <AlertDialogDescription>
              The original CSV and its history entry are removed. The {affected} attendance mark(s) already created from it are <strong>kept</strong>. Use "Delete imported attendance" first if you also want those removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (action) setImports((p) => p.filter((x) => x.id !== action.rec.id));
              close();
            }}>Delete file</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action?.kind === "deleteAttendance"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {affected} imported attendance mark(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Only marks created by {action?.rec.filename} are removed. Marks from other imports and manual marking are preserved. The file itself stays in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (action) setRecords((p) => p.filter((r) => r.importId !== action.rec.id));
              close();
            }}>Delete {affected} mark(s)</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
