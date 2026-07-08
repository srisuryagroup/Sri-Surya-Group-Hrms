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
import { Wallet, Plus, Loader2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll — Sri Surya Group HRMS" }] }),
  component: PayrollPage,
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function PayrollPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "all">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees-payroll"],
    queryFn: async () => ((await supabase.from("employees").select("id,full_name,salary,email").order("full_name")).data ?? []) as any[],
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["payroll", year, month],
    queryFn: async () => {
      let q = supabase.from("payroll").select("*, employees(full_name,email)").eq("year", year).order("month", { ascending: false });
      if (month !== "all") q = q.eq("month", month);
      return ((await q).data ?? []) as any[];
    },
  });

  const totals = useMemo(() => {
    const r = rows ?? [];
    return {
      gross: r.reduce((s: number, x: any) => s + Number(x.basic_salary) + Number(x.allowances) + Number(x.bonus), 0),
      net: r.reduce((s: number, x: any) => s + Number(x.net_salary ?? 0), 0),
      paid: r.filter((x: any) => x.payment_status === "paid").length,
      pending: r.filter((x: any) => x.payment_status === "pending").length,
    };
  }, [rows]);

  const saveMut = useMutation({
    mutationFn: async (p: any) => {
      const num = (v: any) => (v === "" || v == null ? 0 : Number(v));
      const basic = num(p.basic_salary), allw = num(p.allowances), bonus = num(p.bonus);
      const pf = num(p.pf), esi = num(p.esi), tax = num(p.tax), other = num(p.other_deductions);
      const net = basic + allw + bonus - pf - esi - tax - other;
      const payload = { ...p, basic_salary: basic, allowances: allw, bonus, pf, esi, tax, other_deductions: other, net_salary: net };
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      if (payload.id) {
        const { id, ...u } = payload;
        const { error } = await supabase.from("payroll").update(u).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payroll").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll").update({ payment_status: "paid", paid_on: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll"] }); toast.success("Marked as paid"); },
  });

  const downloadPayslip = (r: any) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip - ${r.employees?.full_name}</title>
      <style>body{font-family:system-ui;padding:40px;color:#111}h1{color:#c48a3a}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #ddd;padding:10px;text-align:left}.tot{background:#fafafa;font-weight:700}</style>
      </head><body>
        <h1>Sri Surya Group — Payslip</h1>
        <p><strong>Employee:</strong> ${r.employees?.full_name ?? ""}<br/>
           <strong>Period:</strong> ${MONTHS[r.month - 1]} ${r.year}</p>
        <table>
          <tr><th>Earnings</th><th>Amount (₹)</th></tr>
          <tr><td>Basic salary</td><td>${Number(r.basic_salary).toLocaleString("en-IN")}</td></tr>
          <tr><td>Allowances</td><td>${Number(r.allowances).toLocaleString("en-IN")}</td></tr>
          <tr><td>Bonus</td><td>${Number(r.bonus).toLocaleString("en-IN")}</td></tr>
        </table>
        <table>
          <tr><th>Deductions</th><th>Amount (₹)</th></tr>
          <tr><td>PF</td><td>${Number(r.pf).toLocaleString("en-IN")}</td></tr>
          <tr><td>ESI</td><td>${Number(r.esi).toLocaleString("en-IN")}</td></tr>
          <tr><td>Tax</td><td>${Number(r.tax).toLocaleString("en-IN")}</td></tr>
          <tr><td>Other</td><td>${Number(r.other_deductions).toLocaleString("en-IN")}</td></tr>
        </table>
        <table><tr class="tot"><td>Net salary</td><td>₹${Number(r.net_salary).toLocaleString("en-IN")}</td></tr></table>
        <p style="margin-top:30px;color:#666;font-size:12px">© Sri Surya Group. This is a system-generated payslip.</p>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Monthly salaries, bonuses, deductions and payslip generation."
        actions={
          <>
            {isManager && (
              <Button
                onClick={() => { setEditing({ month: now.getMonth() + 1, year, payment_status: "pending" }); setOpen(true); }}
                className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90"
              >
                <Plus className="mr-1.5 h-4 w-4" />Add payroll
              </Button>
            )}
            <Button variant="outline" disabled={!(rows ?? []).length} onClick={() => exportToCsv(`payroll-${year}${month === "all" ? "" : `-${month}`}.csv`, (rows ?? []).map((r: any) => ({
              employee: r.employees?.full_name, month: r.month, year: r.year,
              basic: r.basic_salary, allowances: r.allowances, bonus: r.bonus,
              pf: r.pf, esi: r.esi, tax: r.tax, other: r.other_deductions,
              net: r.net_salary, status: r.payment_status,
            })))}>Export CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Gross payout", value: `₹${totals.gross.toLocaleString("en-IN")}`, tone: "text-foreground" },
          { label: "Net paid out", value: `₹${totals.net.toLocaleString("en-IN")}`, tone: "text-success" },
          { label: "Paid entries", value: totals.paid, tone: "text-success" },
          { label: "Pending entries", value: totals.pending, tone: "text-warning" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (rows ?? []).length === 0 ? (
          <EmptyState icon={Wallet} title="No payroll entries" description="Add a monthly payroll entry for an employee to get started." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Basic</TableHead>
                  <TableHead>Allowances</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows!.map((r: any) => (
                  <TableRow key={r.id} className="border-border/40">
                    <TableCell className="font-medium">{r.employees?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{MONTHS[r.month - 1]} {r.year}</TableCell>
                    <TableCell>₹{Number(r.basic_salary).toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{(Number(r.allowances) + Number(r.bonus)).toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{(Number(r.pf) + Number(r.esi) + Number(r.tax) + Number(r.other_deductions)).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="font-semibold">₹{Number(r.net_salary).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={r.payment_status === "paid" ? "bg-success/15 text-success" : r.payment_status === "pending" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}>
                        {r.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => downloadPayslip(r)}>
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                        {isManager && r.payment_status !== "paid" && (
                          <Button size="sm" variant="outline" onClick={() => markPaid.mutate(r.id)}>Mark paid</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payroll entry</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(editing); }} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label className="text-xs">Employee *</Label>
                <Select value={editing.employee_id ?? ""} onValueChange={(v) => {
                  const emp = (employees ?? []).find((e) => e.id === v);
                  setEditing({ ...editing, employee_id: v, basic_salary: emp?.salary ?? editing.basic_salary });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Month</Label>
                <Select value={String(editing.month)} onValueChange={(v) => setEditing({ ...editing, month: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Year</Label>
                <Input type="number" value={editing.year} onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) })} />
              </div>
              <div />
              {[
                ["basic_salary", "Basic"],
                ["allowances", "Allowances"],
                ["bonus", "Bonus"],
                ["pf", "PF"],
                ["esi", "ESI"],
                ["tax", "Tax"],
                ["other_deductions", "Other deductions"],
              ].map(([k, l]) => (
                <div key={k} className="space-y-1.5">
                  <Label className="text-xs">{l} (₹)</Label>
                  <Input type="number" value={editing[k] ?? ""} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={editing.payment_status} onValueChange={(v) => setEditing({ ...editing, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="sm:col-span-3">
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
