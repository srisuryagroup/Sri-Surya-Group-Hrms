import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarCheck,
  ClipboardList,
  CheckSquare,
  Wallet,
  UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEmployee } from "@/hooks/use-my-record";

type TaskRow = {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  due_date: string | null;
};

export function EmployeeDashboard() {
  const { data: me, isLoading: meLoading } = useMyEmployee();
  const employeeId = me?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["employee-dashboard", employeeId, me?.email],
    enabled: !!employeeId,
    queryFn: async () => {
      const monthStart = format(new Date(), "yyyy-MM-01");
      const [attendance, leaves, tasks, payslips] = await Promise.all([
        supabase
          .from("attendance")
          .select("id,date,status,check_in,check_out")
          .eq("employee_id", employeeId!)
          .gte("date", monthStart)
          .order("date", { ascending: false }),
        supabase
          .from("leave_requests")
          .select("id,leave_type,status,start_date,end_date,days")
          .eq("employee_id", employeeId!)
          .order("start_date", { ascending: false })
          .limit(5),
        supabase
          .from("tasks")
          .select("id,name,status,priority,due_date")
          .eq("assignee_id", employeeId!)
          .order("due_date", { ascending: true })
          .limit(6),
        supabase
          .from("payroll")
          .select("id,month,year,net_salary,payment_status")
          .eq("employee_id", employeeId!)
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .limit(3),
      ]);

      const att = attendance.data ?? [];
      return {
        presentDays: att.filter((a) => a.status === "present").length,
        attendance: att.slice(0, 5),
        leaves: leaves.data ?? [],
        pendingLeaves: (leaves.data ?? []).filter((l) => l.status === "pending").length,
        tasks: (tasks.data ?? []) as TaskRow[],
        openTasks: (tasks.data ?? []).filter(
          (t) => t.status === "pending" || t.status === "in_progress",
        ).length,
        payslips: payslips.data ?? [],
      };
    },
  });

  if (meLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${me?.full_name ?? "there"}`}
        description="Your attendance, leave, tasks and payslips at a glance."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/attendance">
                <CalendarCheck className="mr-1.5 h-4 w-4" /> Clock In / Out
              </Link>
            </Button>
            <Button
              asChild
              className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90"
            >
              <Link to="/leave">Apply Leave</Link>
            </Button>
          </>
        }
      />

      {!me && (
        <Card className="glass-card border-border/40">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No employee record is linked to <strong>{"your account"}</strong> yet. Ask HR to
            add your employee profile using the same email address, then this dashboard will
            fill up automatically.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Present This Month"
              value={data?.presentDays ?? 0}
              icon={CalendarCheck}
              tone="success"
            />
            <StatCard
              label="Open Tasks"
              value={data?.openTasks ?? 0}
              icon={CheckSquare}
              tone="warning"
            />
            <StatCard
              label="Pending Leave"
              value={data?.pendingLeaves ?? 0}
              icon={ClipboardList}
              tone="info"
            />
            <StatCard
              label="Payslips"
              value={data?.payslips.length ?? 0}
              icon={Wallet}
              tone="primary"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base">My Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.tasks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
            ) : (
              (data?.tasks ?? []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/30 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.due_date ? `Due ${t.due_date}` : "No due date"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                    {(t.status ?? "pending").replaceAll("_", " ")}
                  </Badge>
                </div>
              ))
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/tasks">View all tasks</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.attendance ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
            ) : (
              (data?.attendance ?? []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-3 text-sm"
                >
                  <span>{a.date}</span>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {(a.status ?? "").replaceAll("_", " ")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Leave Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.leaves ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests yet.</p>
            ) : (
              (data?.leaves ?? []).map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-3 text-sm"
                >
                  <span className="capitalize">
                    {l.leave_type} · {l.days} day(s)
                  </span>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {l.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Latest Payslips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.payslips ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No payslips generated yet.</p>
            ) : (
              (data?.payslips ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-3 text-sm"
                >
                  <span>
                    {p.month}/{p.year}
                  </span>
                  <span className="font-semibold">
                    ₹{Number(p.net_salary ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
              ))
            )}
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/payroll">
                  <Wallet className="mr-1.5 h-4 w-4" /> Payroll
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/my-profile">
                  <UserCircle className="mr-1.5 h-4 w-4" /> My Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
