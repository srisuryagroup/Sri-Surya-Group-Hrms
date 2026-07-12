import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Users, Briefcase, Wallet, BadgeIndianRupee, FolderKanban, CalendarCheck, FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToCsv, exportToXlsx, exportToPdf } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Sri Surya Group HRMS" }] }),
  component: ReportsPage,
});

const REPORTS = [
  { key: "employees", title: "Employees", icon: Users, description: "Full employee directory with department and joining date." },
  { key: "freelancers", title: "Freelancers", icon: Briefcase, description: "All freelancers, skills, rates and availability." },
  { key: "attendance", title: "Attendance", icon: CalendarCheck, description: "Recent attendance records with hours worked." },
  { key: "payroll", title: "Payroll", icon: Wallet, description: "Monthly salary payouts, deductions and net pay." },
  { key: "commissions", title: "Commissions", icon: BadgeIndianRupee, description: "Employee, freelancer and referral commissions." },
  { key: "projects", title: "Projects", icon: FolderKanban, description: "Project list, status, budget and timelines." },
] as const;

async function fetchReport(key: string) {
  const map: Record<string, () => Promise<any[]>> = {
    employees: async () => ((await supabase.from("employees").select("employee_code,full_name,email,mobile,designation,salary,status,joining_date,departments(name)").order("full_name")).data ?? []).map((r: any) => ({ ...r, department: r.departments?.name ?? "" })),
    freelancers: async () => ((await supabase.from("freelancers").select("*").order("full_name")).data ?? []),
    attendance: async () => ((await supabase.from("attendance").select("date,status,check_in,check_out,hours_worked,employees(full_name)").order("date", { ascending: false }).limit(1000)).data ?? []).map((r: any) => ({ ...r, employee: r.employees?.full_name ?? "" })),
    payroll: async () => ((await supabase.from("payroll").select("month,year,basic_salary,allowances,bonus,pf,esi,tax,other_deductions,net_salary,payment_status,employees(full_name)").order("year", { ascending: false }).order("month", { ascending: false })).data ?? []).map((r: any) => ({ ...r, employee: r.employees?.full_name ?? "" })),
    commissions: async () => ((await supabase.from("commissions").select("commission_type,recipient_name,amount,payment_status,payment_date").order("created_at", { ascending: false })).data ?? []),
    projects: async () => ((await supabase.from("projects").select("name,status,priority,budget,start_date,end_date,progress").order("created_at", { ascending: false })).data ?? []),
  };
  return map[key]();
}

function flatten(rows: any[]) {
  return rows.map((r) => {
    const o: any = {};
    for (const k of Object.keys(r)) if (r[k] === null || typeof r[k] !== "object") o[k] = r[k];
    return o;
  });
}

function ReportsPage() {
  const counts = useQuery({
    queryKey: ["report-counts"],
    queryFn: async () => {
      const keys = REPORTS.map((r) => r.key);
      const results = await Promise.all(keys.map((k) => supabase.from(k as any).select("id", { count: "exact", head: true })));
      return Object.fromEntries(keys.map((k, i) => [k, results[i].count ?? 0]));
    },
  });

  const download = async (key: string, fmt: "csv" | "xlsx" | "pdf", title: string) => {
    try {
      const rows = await fetchReport(key);
      if (!rows.length) { toast.info("No data to export"); return; }
      const flat = flatten(rows);
      const date = new Date().toISOString().slice(0, 10);
      if (fmt === "csv") exportToCsv(`${key}-${date}.csv`, flat);
      else if (fmt === "xlsx") exportToXlsx(`${key}-${date}.xlsx`, flat);
      else exportToPdf(`${key}-${date}.pdf`, title, flat);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to export");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download CSV, Excel and PDF exports across every core module."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.key} className="glass-card border-border/40">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{r.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{r.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-foreground">{counts.data?.[r.key] ?? "—"}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => download(r.key, "csv", r.title)} title="Export CSV">
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => download(r.key, "xlsx", r.title)} title="Export Excel">
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => download(r.key, "pdf", r.title)} title="Export PDF">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
