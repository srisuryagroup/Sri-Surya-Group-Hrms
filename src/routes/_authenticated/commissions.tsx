import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, BadgeIndianRupee, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/commissions")({
  head: () => ({ meta: [{ title: "Commissions — Sri Surya Group HRMS" }] }),
  component: CommissionsPage,
});

function CommissionsPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["commissions"],
    queryFn: async () => ((await supabase.from("commissions").select("*").order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const upsertMut = useMutation({
    mutationFn: async (p: any) => {
      const c: any = { ...p };
      Object.keys(c).forEach((k) => { if (c[k] === "") c[k] = null; });
      ["fixed_amount", "percentage", "amount"].forEach((k) => { if (typeof c[k] === "string") c[k] = c[k] ? Number(c[k]) : null; });
      if (c.id) { const { error } = await supabase.from("commissions").update(c).eq("id", c.id); if (error) throw error; }
      else { delete c.id; const { error } = await supabase.from("commissions").insert(c); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["commissions"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commissions").update({ payment_status: "paid", payment_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["commissions"] }); toast.success("Marked as paid"); },
  });

  const totalPending = (rows ?? []).filter((r: any) => r.payment_status === "pending").reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const totalPaid = (rows ?? []).filter((r: any) => r.payment_status === "paid").reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commissions"
        description="Track employee, freelancer and referral commission payouts."
        actions={isManager && (
          <Button onClick={() => { setEditing({ commission_type: "employee", payment_status: "pending" }); setOpen(true); }} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" />New Commission
          </Button>
        )}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending payout</div>
          <div className="mt-1 text-3xl font-bold text-warning">₹{totalPending.toLocaleString("en-IN")}</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total paid</div>
          <div className="mt-1 text-3xl font-bold text-success">₹{totalPaid.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (rows ?? []).length === 0 ? (
          <EmptyState icon={BadgeIndianRupee} title="No commissions yet" description="Record commissions to keep payout history." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>Type</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment date</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows!.map((r: any) => (
                  <TableRow key={r.id} className="border-border/40">
                    <TableCell><Badge variant="secondary" className="capitalize">{r.commission_type}</Badge></TableCell>
                    <TableCell className="font-medium">{r.recipient_name}</TableCell>
                    <TableCell className="font-semibold">₹{Number(r.amount ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell><Badge variant="secondary" className={r.payment_status === "paid" ? "bg-success/15 text-success" : r.payment_status === "pending" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}>{r.payment_status}</Badge></TableCell>
                    <TableCell className="text-sm">{r.payment_date ? format(new Date(r.payment_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground line-clamp-1">{r.remarks ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {isManager && r.payment_status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => markPaid.mutate(r.id)}>
                          <Check className="mr-1 h-3.5 w-3.5" />Mark paid
                        </Button>
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
          <DialogHeader><DialogTitle>New commission</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); upsertMut.mutate(editing); }} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <F label="Type" full>
                <Select value={editing.commission_type} onValueChange={(v) => setEditing({ ...editing, commission_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="freelancer">Freelancer</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Recipient name" required full><Input value={editing.recipient_name ?? ""} onChange={(e) => setEditing({ ...editing, recipient_name: e.target.value })} required /></F>
              <F label="Fixed amount (₹)"><Input type="number" value={editing.fixed_amount ?? ""} onChange={(e) => setEditing({ ...editing, fixed_amount: e.target.value })} /></F>
              <F label="Percentage %"><Input type="number" step="0.1" value={editing.percentage ?? ""} onChange={(e) => setEditing({ ...editing, percentage: e.target.value })} /></F>
              <F label="Final amount (₹)" full><Input type="number" value={editing.amount ?? ""} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} /></F>
              <F label="Status">
                <Select value={editing.payment_status} onValueChange={(v) => setEditing({ ...editing, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent>
                </Select>
              </F>
              <F label="Payment date"><Input type="date" value={editing.payment_date ?? ""} onChange={(e) => setEditing({ ...editing, payment_date: e.target.value })} /></F>
              <F label="Remarks" full><Textarea rows={2} value={editing.remarks ?? ""} onChange={(e) => setEditing({ ...editing, remarks: e.target.value })} /></F>
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={upsertMut.isPending} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                  {upsertMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, required, full, children }: any) {
  return <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}><Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>{children}</div>;
}
