import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocalNotice, PageHeader } from "@/components/shared";
import { useStore } from "@/lib/store";
import type { MarkTreatment } from "@/lib/types";

const LABEL: Record<MarkTreatment, string> = {
  present: "Count as present",
  absent: "Count as absent",
  exclude: "Exclude from percentage",
};

export function SettingsPage() {
  const { rules, setRules } = useStore();
  const field = (key: "late" | "excused", title: string) => (
    <div className="space-y-1.5">
      <Label>{title}</Label>
      <Select value={rules[key]} onValueChange={(v) => setRules((r) => ({ ...r, [key]: v as MarkTreatment }))}>
        <SelectTrigger aria-label={title}><SelectValue /></SelectTrigger>
        <SelectContent>{(Object.keys(LABEL) as MarkTreatment[]).map((k) => <SelectItem key={k} value={k}>{LABEL[k]}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  return (
    <div>
      <PageHeader title="Settings" description="Rules used for attendance percentages across the dashboard and reports." />
      <LocalNotice />
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">Attendance calculation rules</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Percentage = present-equivalent sessions ÷ counted sessions. Unmarked and cancelled sessions are always excluded from the denominator and never counted as absent.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("late", "Late marks")}
            {field("excused", "Excused marks")}
          </div>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="thr">Low attendance threshold (%)</Label>
            <Input id="thr" type="number" min={0} max={100} value={rules.lowAttendanceThreshold}
              onChange={(e) => setRules((r) => ({ ...r, lowAttendanceThreshold: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
