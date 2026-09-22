import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeIndianRupee, Wallet, Percent, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMyFreelancer } from "@/hooks/use-my-record";
import { inr } from "@/lib/money";
import { exportToCsv, exportToPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings — Sri Surya Group HRMS" },
      {
        name: "description",
        content:
          "Track your commission percentage, total earnings, paid and pending payments.",
      },
      { property: "og:title", content: "Earnings — Sri Surya Group HRMS" },
      {
        property: "og:description",
        content: "Commission percentage, total earnings and payment history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EarningsPage,
});

function EarningsPage() {
  const { data: me, isLoading: meLoading } = useMyFreelancer();
  const freelancerId = me?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["my-earnings", freelancerId],
    enabled: !!freelancerId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("commissions")
        .select(
          "id,amount,percentage,fixed_amount,project_value,payment_status,payment_date,commission_type,remarks,projects(name)",
        )
        .eq("recipient_id", freelancerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = (rows ?? []).map((r) => {
        const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
        return { ...r, projectName: project?.name ?? "—" };
      });
      const sum = (status?: string) =>
        list
          .filter((c) => (status ? c.payment_status === status : true))
          .reduce((s, c) => s + Number(c.amount ?? 0), 0);

      return {
        list,
        total: sum(),
        paid: sum("paid"),
        pending: sum("pending"),
      };
    },
  });

  if (meLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Earnings" description="Your commissions and payments." />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="space-y-6">
        <PageHeader title="Earnings" description="Your commissions and payments." />
        <EmptyState
          icon={BadgeIndianRupee}
          title="No freelancer record linked"
          description="Your account is not linked to a freelancer record yet. Ask the admin to create it using this same email address."
        />
      </div>
    );
  }

  const exportRows = (data?.list ?? []).map((c) => ({
    Project: c.projectName,
    Type: c.commission_type,
    "Project Value": Number(c.project_value ?? 0),
    "Percentage %": Number(c.percentage ?? me.commission_percentage ?? 0),
    Amount: Number(c.amount ?? 0),
    Status: c.payment_status,
    "Payment Date": c.payment_date ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        description="Commission percentage, auto-calculated amounts and payment history."
        actions={
          <>
            <Button
              variant="outline"
              disabled={exportRows.length === 0}
              onClick={() => exportToCsv("my-earnings.csv", exportRows)}
            >
              <FileDown className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline"
              disabled={exportRows.length === 0}
              onClick={() => exportToPdf("my-earnings.pdf", "My Earnings", exportRows)}
            >
              <FileDown className="mr-1.5 h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Commission %"
              value={`${Number(me.commission_percentage ?? 0)}%`}
              icon={Percent}
              tone="info"
            />
            <StatCard
              label="Total Commission Earned"
              value={inr(data?.total ?? 0)}
              icon={Wallet}
              tone="success"
            />
            <StatCard
              label="Paid"
              value={inr(data?.paid ?? 0)}
              icon={BadgeIndianRupee}
              tone="primary"
            />
            <StatCard
              label="Pending"
              value={inr(data?.pending ?? 0)}
              icon={BadgeIndianRupee}
              tone="destructive"
            />
          </>
        )}
      </div>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : (data?.list ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No commissions recorded yet. They will appear here once the admin adds them.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Project Value</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.list ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.projectName}</TableCell>
                      <TableCell>{inr(c.project_value)}</TableCell>
                      <TableCell>
                        {Number(c.percentage ?? me.commission_percentage ?? 0)}%
                      </TableCell>
                      <TableCell className="font-semibold">{inr(c.amount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            c.payment_status === "paid"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning"
                          }
                        >
                          {c.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.payment_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
