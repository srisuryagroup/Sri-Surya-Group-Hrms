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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Users, Pencil, Trash2, Download, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { exportToCsv } from "@/lib/csv";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Sri Surya Group HRMS" }] }),
  component: EmployeesPage,
});

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  mobile: string | null;
  gender: string | null;
  date_of_birth: string | null;
  department_id: string | null;
  designation: string | null;
  joining_date: string | null;
  employment_type: string | null;
  salary: number | null;
  aadhaar_number: string | null;
  pan_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  address: string | null;
  emergency_contact: string | null;
  status: string;
};

const empty: Partial<Employee> = {
  full_name: "", email: "", mobile: "", designation: "", employment_type: "full_time", status: "active",
};

function EmployeesPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () =>
      ((await supabase.from("employees").select("*, departments(name)").order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (rows ?? []).filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (deptFilter !== "all" && r.department_id !== deptFilter) return false;
      if (!q) return true;
      return (
        r.full_name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.employee_code?.toLowerCase().includes(q) ||
        r.designation?.toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter, deptFilter]);

  const upsertMut = useMutation({
    mutationFn: async (payload: Partial<Employee>) => {
      const cleaned: any = { ...payload };
      if (cleaned.salary === "" || cleaned.salary === undefined) cleaned.salary = null;
      else cleaned.salary = Number(cleaned.salary);
      Object.keys(cleaned).forEach((k) => { if (cleaned[k] === "") cleaned[k] = null; });
      delete cleaned.employee_code;
      delete cleaned.departments;
      if (cleaned.id) {
        const { error } = await supabase.from("employees").update(cleaned).eq("id", cleaned.id);
        if (error) throw error;
      } else {
        delete cleaned.id;
        const { error } = await supabase.from("employees").insert(cleaned);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setEditing(null);
      toast.success("Saved successfully");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Employee deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const openNew = () => { setEditing({ ...empty }); setOpen(true); };
  const openEdit = (row: Employee) => { setEditing(row); setOpen(true); };
  const handleExport = () => {
    exportToCsv("employees.csv", filtered.map((r: any) => ({
      Code: r.employee_code, Name: r.full_name, Email: r.email, Mobile: r.mobile,
      Department: r.departments?.name, Designation: r.designation, Salary: r.salary, Status: r.status,
    })));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage all Sri Surya Group employees, their details and access."
        actions={
          <>
            <Button variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />Export CSV</Button>
            {isManager && (
              <Button onClick={openNew} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                <Plus className="mr-1.5 h-4 w-4" />Add Employee
              </Button>
            )}
          </>
        }
      />

      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, email, code…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_leave">On leave</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {(departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No employees found" description="Try adjusting your filters, or add your first employee." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id} className="border-border/40">
                    <TableCell className="font-mono text-xs">{r.employee_code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.departments?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.designation ?? "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{r.employment_type?.replace("_", " ")}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {isManager && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete employee?</AlertDialogTitle>
                                <AlertDialogDescription>This permanently removes {r.full_name} from your records.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMut.mutate(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit employee" : "Add employee"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <EmployeeForm
              value={editing}
              onChange={setEditing}
              departments={departments ?? []}
              onSubmit={() => upsertMut.mutate(editing)}
              submitting={upsertMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    on_leave: "bg-warning/15 text-warning",
    inactive: "bg-muted text-muted-foreground",
    terminated: "bg-destructive/15 text-destructive",
  };
  return <Badge variant="secondary" className={map[status] ?? ""}>{status.replace("_", " ")}</Badge>;
}

function EmployeeForm({
  value, onChange, departments, onSubmit, submitting,
}: {
  value: Partial<Employee>;
  onChange: (v: Partial<Employee>) => void;
  departments: any[];
  onSubmit: () => void;
  submitting: boolean;
}) {
  const set = (k: keyof Employee, v: any) => onChange({ ...value, [k]: v });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
      <Field label="Full name" required><Input value={value.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} required /></Field>
      <Field label="Email" required><Input type="email" value={value.email ?? ""} onChange={(e) => set("email", e.target.value)} required /></Field>
      <Field label="Mobile"><Input value={value.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} /></Field>
      <Field label="Gender">
        <Select value={value.gender ?? ""} onValueChange={(v) => set("gender", v)}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Date of birth"><Input type="date" value={value.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value)} /></Field>
      <Field label="Joining date"><Input type="date" value={value.joining_date ?? ""} onChange={(e) => set("joining_date", e.target.value)} /></Field>
      <Field label="Department">
        <Select value={value.department_id ?? ""} onValueChange={(v) => set("department_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Designation"><Input value={value.designation ?? ""} onChange={(e) => set("designation", e.target.value)} /></Field>
      <Field label="Employment type">
        <Select value={value.employment_type ?? "full_time"} onValueChange={(v) => set("employment_type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full_time">Full-time</SelectItem>
            <SelectItem value="part_time">Part-time</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="intern">Intern</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Salary (₹)"><Input type="number" value={value.salary ?? ""} onChange={(e) => set("salary", e.target.value as any)} /></Field>
      <Field label="Aadhaar"><Input value={value.aadhaar_number ?? ""} onChange={(e) => set("aadhaar_number", e.target.value)} /></Field>
      <Field label="PAN"><Input value={value.pan_number ?? ""} onChange={(e) => set("pan_number", e.target.value)} /></Field>
      <Field label="Bank name"><Input value={value.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} /></Field>
      <Field label="Account number"><Input value={value.account_number ?? ""} onChange={(e) => set("account_number", e.target.value)} /></Field>
      <Field label="IFSC"><Input value={value.ifsc_code ?? ""} onChange={(e) => set("ifsc_code", e.target.value)} /></Field>
      <Field label="UPI ID"><Input value={value.upi_id ?? ""} onChange={(e) => set("upi_id", e.target.value)} /></Field>
      <Field label="Emergency contact"><Input value={value.emergency_contact ?? ""} onChange={(e) => set("emergency_contact", e.target.value)} /></Field>
      <Field label="Status">
        <Select value={value.status ?? "active"} onValueChange={(v) => set("status", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_leave">On leave</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Address" full><Input value={value.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
      <DialogFooter className="sm:col-span-2">
        <Button type="submit" disabled={submitting} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {value.id ? "Save changes" : "Create employee"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
