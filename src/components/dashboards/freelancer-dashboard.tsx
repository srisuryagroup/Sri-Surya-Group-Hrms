import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FolderKanban,
  CheckSquare,
  BadgeIndianRupee,
  Wallet,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyFreelancer } from "@/hooks/use-my-record";
import { inr } from "@/lib/money";

export function FreelancerDashboard() {
  const { data: me, isLoading: meLoading } = useMyFreelancer();
  const freelancerId = me?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["freelancer-dashboard", freelancerId],
    enabled: !!freelancerId,
    queryFn: async () => {
      const [assignments, tasks, commissions, updates] = await Promise.all([
        supabase
          .from("project_assignments")
          .select("id, projects(id,name,status,progress,end_date)")
          .eq("assignee_type", "freelancer")
          .eq("assignee_id", freelancerId!),
        supabase
          .from("tasks")
          .select("id,name,status,priority,due_date")
          .eq("assignee_id", freelancerId!)
          .order("due_date", { ascending: true })
          .limit(6),
        supabase
          .from("commissions")
          .select("id,amount,percentage,payment_status,payment_date,recipient_name")
          .eq("recipient_id", freelancerId!),
        supabase
          .from("work_updates")
          .select("id,title,status,work_date")
          .eq("freelancer_id", freelancerId!)
          .order("work_date", { ascending: false })
          .limit(5),
      ]);

      const comm = commissions.data ?? [];
      const sum = (status?: string) =>
        comm
          .filter((c) => (status ? c.payment_status === status : true))
          .reduce((s, c) => s + Number(c.amount ?? 0), 0);

      const projects = (assignments.data ?? [])
        .map((a) => {
          const p = a.projects as
            | { id: string; name: string; status: string | null; progress: number | null; end_date: string | null }
            | null;
          return p;
        })
        .filter(Boolean) as {
        id: string;
        name: string;
        status: string | null;
        progress: number | null;
        end_date: string | null;
      }[];

      return {
        projects,
        tasks: tasks.data ?? [],
        openTasks: (tasks.data ?? []).filter(
          (t) => t.status === "pending" || t.status === "in_progress",
        ).length,
        total: sum(),
        paid: sum("paid"),
        pending: sum("pending"),
        updates: updates.data ?? [],
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
        description="Your projects, tasks, work updates and earnings."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/my-work">
                <Send className="mr-1.5 h-4 w-4" /> Submit Work Update
              </Link>
            </Button>
            <Button
              asChild
              className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90"
            >
              <Link to="/earnings">View Earnings</Link>
            </Button>
          </>
        }
      />

      {!me && (
        <Card className="glass-card border-border/40">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No freelancer record is linked to your account yet. Ask the admin to add your
            freelancer profile using the same email address.
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
              label="Assigned Projects"
              value={data?.projects.length ?? 0}
              icon={FolderKanban}
              tone="primary"
            />
            <StatCard
              label="Open Tasks"
              value={data?.openTasks ?? 0}
              icon={CheckSquare}
              tone="warning"
            />
            <StatCard
              label="Total Earnings"
              value={inr(data?.total ?? 0)}
              icon={Wallet}
              tone="success"
            />
            <StatCard
              label="Pending Payments"
              value={inr(data?.pending ?? 0)}
              icon={BadgeIndianRupee}
              tone="destructive"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Assigned Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.projects ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects assigned yet.</p>
            ) : (
              (data?.projects ?? []).map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border/40 bg-card/30 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {(p.status ?? "").replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-gradient-surya"
                      style={{ width: `${Math.min(100, Number(p.progress ?? 0))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Commission Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Commission percentage</span>
              <span className="font-semibold">
                {Number(me?.commission_percentage ?? 0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total earnings</span>
              <span className="font-semibold">{inr(data?.total ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-semibold text-emerald-400">{inr(data?.paid ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-semibold text-amber-400">{inr(data?.pending ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Recent Work Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.updates ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No work updates submitted yet.</p>
            ) : (
              (data?.updates ?? []).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-3 text-sm"
                >
                  <span className="truncate">{u.title}</span>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {u.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
