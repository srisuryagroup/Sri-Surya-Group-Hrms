import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CalendarCheck, Plus, LogIn, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from "date-fns";
import { exportToCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Sri Surya Group HRMS" }] }),
  component: AttendancePage,
});

const STATUS_TONE: Record<string, string> = {
  present: "bg-success/15 text-success",
  late: "bg-warning/15 text-warning",
  half_day: "bg-warning/15 text-warning",
  work_from_home: "bg-info/15 text-info",
  absent: "bg-destructive/15 text-destructive",
  on_leave: "bg-muted text-muted-foreground",
};

function AttendancePage() {
  const { user, isManager } = useAuth();
  const qc = useQueryClient();
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees-lite"],
    queryFn: async () => ((await supabase.from("employees").select("id,full_name,email").order("full_name")).data ?? []) as any[],
  });

  const myEmployee = useMemo(
    () => (employees ?? []).find((e) => e.email === user?.email),
    [employees, user?.email],
  );

  const { data: rows, isLoading } = useQuery({
    queryKey: ["attendance", filterDate, isManager],
    queryFn: async () => {
      let q = supabase.from("attendance").select("*, employees(full_name, email)").order("date", { ascending: false }).limit(200);
      if (filterDate) q = q.eq("date", filterDate);
      return ((await q).data ?? []) as any[];
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      if (!myEmployee) throw new Error("No employee record linked to your email. Ask HR to add you.");
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase.from("attendance").select("id, check_in").eq("employee_id", myEmployee.id).eq("date", today).maybeSingle();
      if (existing?.check_in) throw new Error("Already checked in");
      const payload = { employee_id: myEmployee.id, date: today, check_in: new Date().toISOString(), status: "present" };
      if (existing?.id) {
        const { error } = await supabase.from("attendance").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); toast.success("Checked in"); },
    onError: (e: any) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      if (!myEmployee) throw new Error("No employee record linked to your email.");
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase.from("attendance").select("id, check_in, check_out").eq("employee_id", myEmployee.id).eq("date", today).maybeSingle();
      if (!existing?.check_in) throw new Error("Please check in first");
      if (existing.check_out) throw new Error("Already checked out");
      const out = new Date();
      const hours = ((+out - +new Date(existing.check_in)) / 3600000).toFixed(2);
      const { error } = await supabase.from("attendance").update({ check_out: out.toISOString(), hours_worked: Number(hours) }).eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); toast.success("Checked out"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: async (p: any) => {
      const payload = { ...p };
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      if (payload.hours_worked) payload.hours_worked = Number(payload.hours_worked);
      if (payload.id) {
        const { id, ...u } = payload;
        const { error } = await supabase.from("attendance").update(u).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const summary = useMemo(() => {
    const r = rows ?? [];
    return {
      present: r.filter((x) => x.status === "present" || x.status === "late" || x.status === "work_from_home").length,
      absent: r.filter((x) => x.status === "absent").length,
      leave: r.filter((x) => x.status === "on_leave").length,
      wfh: r.filter((x) => x.status === "work_from_home").length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Daily check-in, check-out and attendance records."
        actions={
          <>
            <Button variant="outline" onClick={() => checkIn.mutate()} disabled={checkIn.isPending || !myEmployee}>
              <LogIn className="mr-1.5 h-4 w-4" />Check in
            </Button>
            <Button variant="outline" onClick={() => checkOut.mutate()} disabled={checkOut.isPending || !myEmployee}>
              <LogOut className="mr-1.5 h-4 w-4" />Check out
            </Button>
            {isManager && (
              <Button
                onClick={() => { setEditing({ date: filterDate, status: "present" }); setOpen(true); }}
                className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90"
              >
                <Plus className="mr-1.5 h-4 w-4" />Add entry
              </Button>
            )}
            <Button variant="outline" disabled={!(rows ?? []).length} onClick={() => exportToCsv(`attendance-${filterDate}.csv`, (rows ?? []).map((r: any) => ({
              date: r.date, employee: r.employees?.full_name, status: r.status,
              check_in: r.check_in, check_out: r.check_out, hours: r.hours_worked,
            })))}>Export CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Present", value: summary.present, tone: "text-success" },
          { label: "Absent", value: summary.absent, tone: "text-destructive" },
          { label: "On Leave", value: summary.leave, tone: "text-warning" },
          { label: "Work from home", value: summary.wfh, tone: "text-info" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>Clear</Button>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (rows ?? []).length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No attendance records" description="Check in to start tracking your attendance." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows!.map((r: any) => (
                  <TableRow key={r.id} className="border-border/40">
                    <TableCell className="font-medium">{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{r.employees?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`capitalize ${STATUS_TONE[r.status] ?? ""}`}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.check_in ? format(new Date(r.check_in), "h:mm a") : "—"}</TableCell>
                    <TableCell className="text-sm">{r.check_out ? format(new Date(r.check_out), "h:mm a") : "—"}</TableCell>
                    <TableCell className="text-sm font-semibold">{r.hours_worked ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attendance entry</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(editing); }} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Employee *</Label>
                <Select value={editing.employee_id ?? ""} onValueChange={(v) => setEditing({ ...editing, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={editing.date ?? ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half day</SelectItem>
                    <SelectItem value="work_from_home">Work from home</SelectItem>
                    <SelectItem value="on_leave">On leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hours worked</Label>
                <Input type="number" step="0.25" value={editing.hours_worked ?? ""} onChange={(e) => setEditing({ ...editing, hours_worked: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={saveMut.isPending || !editing.employee_id} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                  {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
