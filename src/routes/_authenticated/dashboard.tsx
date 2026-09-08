import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Users,
  Briefcase,
  Building2,
  FolderKanban,
  CheckSquare,
  CalendarCheck,
  ClipboardList,
  BadgeIndianRupee,
  Plus,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

type DepartmentRow = {
  id: string;
  departments: { name: string | null } | { name: string | null }[] | null;
};

type ProjectStatusRow = {
  status: string | null;
};

type RecentActivity = {
  id: string;
  title: string;
  message: string | null;
  category: string | null;
  created_at: string | null;
};

function getDepartmentName(departments: DepartmentRow["departments"]): string {
  const department = Array.isArray(departments) ? departments[0] : departments;
  return department?.name?.trim() || "Unassigned";
}

function formatActivityDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, "MMM d, h:mm a");
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Sri Surya Group HRMS" }],
  }),
  component: Dashboard,
});

const CHART_COLORS = ["hsl(var(--chart-1))"];

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [
        emp,
        frl,
        dep,
        proj,
        tasksPending,
        commPending,
        leaveReq,
        empList,
        deptCounts,
        projByStatus,
        recent,
      ] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("freelancers").select("id", { count: "exact", head: true }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }).in("status", ["in_progress", "planning"]),
        supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["pending", "in_progress"]),
        supabase.from("commissions").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "on_leave"),
        supabase.from("employees").select("joining_date").not("joining_date", "is", null),
        supabase.from("employees").select("id, departments(name)"),
        supabase.from("projects").select("status"),
        supabase.from("notifications").select("id,title,message,category,created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const growth = new Map<string, number>();
      (empList.data ?? []).forEach((row) => {
        const d = row.joining_date;
        if (!d) return;
        const key = String(d).slice(0, 7);
        growth.set(key, (growth.get(key) ?? 0) + 1);
      });
      const growthArr = Array.from(growth.entries())
        .sort()
        .slice(-8)
        .map(([month, count]) => ({ month: month.slice(2), employees: count }));

      const deptMap = new Map<string, number>();
      ((deptCounts.data ?? []) as DepartmentRow[]).forEach((row) => {
        const name = getDepartmentName(row.departments);
        deptMap.set(name, (deptMap.get(name) ?? 0) + 1);
      });
      const deptData = Array.from(deptMap.entries()).map(([name, value]) => ({ name, value }));

      const psMap = new Map<string, number>();
      ((projByStatus.data ?? []) as ProjectStatusRow[]).forEach((row) => {
        const status = row.status?.trim() || "unknown";
        psMap.set(status, (psMap.get(status) ?? 0) + 1);
      });
      const projData = Array.from(psMap.entries()).map(([status, count]) => ({
        status: status.replaceAll("_", " "),
        count,
      }));

      return {
        totalEmployees: emp.count ?? 0,
        totalFreelancers: frl.count ?? 0,
        totalDepartments: dep.count ?? 0,
        activeProjects: proj.count ?? 0,
        pendingTasks: tasksPending.count ?? 0,
        pendingCommissions: commPending.count ?? 0,
        onLeaveToday: leaveReq.count ?? 0,
        growth: growthArr,
        deptData,
        projData,
        recent: (recent.data ?? []) as RecentActivity[],
      };
    },
  });

  const stats = [
    { label: "Total Employees", value: data?.totalEmployees ?? 0, icon: Users, tone: "primary" as const },
    { label: "Freelancers", value: data?.totalFreelancers ?? 0, icon: Briefcase, tone: "info" as const },
    { label: "Departments", value: data?.totalDepartments ?? 0, icon: Building2, tone: "success" as const },
    { label: "Active Projects", value: data?.activeProjects ?? 0, icon: FolderKanban, tone: "primary" as const },
    { label: "Pending Tasks", value: data?.pendingTasks ?? 0, icon: CheckSquare, tone: "warning" as const },
    { label: "Today's Attendance", value: `${(data?.totalEmployees ?? 0) - (data?.onLeaveToday ?? 0)}/${data?.totalEmployees ?? 0}`, icon: CalendarCheck, tone: "success" as const },
    { label: "On Leave", value: data?.onLeaveToday ?? 0, icon: ClipboardList, tone: "warning" as const },
    { label: "Pending Commissions", value: data?.pendingCommissions ?? 0, icon: BadgeIndianRupee, tone: "destructive" as const },
  ];

  const PIE_COLORS = ["oklch(0.78 0.17 65)", "oklch(0.7 0.16 235)", "oklch(0.72 0.17 155)", "oklch(0.7 0.2 20)", "oklch(0.7 0.2 305)"];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your workforce, projects and operations."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/employees">Add Employee</Link></Button>
            <Button asChild variant="outline"><Link to="/freelancers">Add Freelancer</Link></Button>
            <Button asChild className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
              <Link to="/projects"><Plus className="mr-1.5 h-4 w-4" />New Project</Link>
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="glass-card border-border/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Employee Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.growth ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="month" stroke="oklch(0.7 0.02 265)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.02 265)" fontSize={12} />
                <Tooltip contentStyle={{ background: "oklch(0.19 0.018 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="employees" stroke="oklch(0.78 0.17 65)" strokeWidth={3} dot={{ fill: "oklch(0.78 0.17 65)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Department Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.deptData ?? []} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {(data?.deptData ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.19 0.018 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(data?.deptData ?? []).map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Projects Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.projData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="status" stroke="oklch(0.7 0.02 265)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.02 265)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "oklch(0.19 0.018 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="oklch(0.78 0.17 65)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recent ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              (data?.recent ?? []).map((n) => (
                <div key={n.id} className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/30 p-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.category && <Badge variant="secondary" className="text-[10px] uppercase">{n.category}</Badge>}
                    </div>
                    {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatActivityDate(n.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
