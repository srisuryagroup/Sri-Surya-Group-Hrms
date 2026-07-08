import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ClipboardList, Plus, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInCalendarDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "Leave — Sri Surya Group HRMS" }] }),
  component: LeavePage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

function LeavePage() {
  const { user, isManager } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: employees } = useQuery({
    queryKey: ["employees-lite"],
    queryFn: async () => ((await supabase.from("employees").select("id,full_name,email").order("full_name")).data ?? []) as any[],
  });
  const myEmployee = useMemo(() => (employees ?? []).find((e) => e.email === user?.email), [employees, user?.email]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["leave", statusFilter],
    queryFn: async () => {
      let q = supabase.from("leave_requests").select("*, employees(full_name, email)").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      return ((await q).data ?? []) as any[];
    },
  });

  const submitMut = useMutation({
    mutationFn: async (p: any) => {
      const days = Math.max(1, differenceInCalendarDays(new Date(p.end_date), new Date(p.start_date)) + 1);
      const payload = { ...p, days };
      if (payload.id) {
        const { id, ...u } = payload;
        const { error } = await supabase.from("leave_requests").update(u).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leave_requests").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave"] }); setOpen(false); setEditing(null); toast.success("Submitted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("leave_requests").update({
        status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["leave"] }); toast.success(`Leave ${v.status}`); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        description="Apply for leave, review balances and approve or reject requests."
        actions={
          <Button
            onClick={() => setEditing({
              employee_id: isManager ? "" : myEmployee?.id,
              leave_type: "casual",
              start_date: new Date().toISOString().slice(0, 10),
              end_date: new Date().toISOString().slice(0, 10),
            }) || setOpen(true)}
            className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90"
          >
            <Plus className="mr-1.5 h-4 w-4" />Apply leave
          </Button>
        }
      />

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (rows ?? []).length === 0 ? (
          <EmptyState icon={ClipboardList} title="No leave requests" description="Apply for leave to see it appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows!.map((r: any) => (
                  <TableRow key={r.id} className="border-border/40">
                    <TableCell className="font-medium">{r.employees?.full_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.leave_type}</Badge></TableCell>
                    <TableCell className="text-sm">{format(new Date(r.start_date), "MMM d")}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.end_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm font-semibold">{r.days}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{r.reason ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`capitalize ${STATUS_TONE[r.status] ?? ""}`}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isManager && r.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => review.mutate({ id: r.id, status: "approved" })}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => review.mutate({ id: r.id, status: "rejected" })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for leave</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); submitMut.mutate(editing); }} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Employee *</Label>
                <Select value={editing.employee_id ?? ""} onValueChange={(v) => setEditing({ ...editing, employee_id: v })} disabled={!isManager && !!myEmployee}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Leave type</Label>
                <Select value={editing.leave_type} onValueChange={(v) => setEditing({ ...editing, leave_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="sick">Sick</SelectItem>
                    <SelectItem value="earned">Earned</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="maternity">Maternity</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div />
              <div className="space-y-1.5">
                <Label className="text-xs">From *</Label>
                <Input type="date" value={editing.start_date ?? ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To *</Label>
                <Input type="date" value={editing.end_date ?? ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Reason</Label>
                <Textarea rows={3} value={editing.reason ?? ""} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} />
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={submitMut.isPending || !editing.employee_id} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                  {submitMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
