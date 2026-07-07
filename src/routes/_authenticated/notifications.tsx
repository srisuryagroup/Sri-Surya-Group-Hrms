import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Sri Surya Group HRMS" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: async () => ((await supabase.from("notifications").select("*").order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications-list"] }); qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] }); },
  });
  const markAll = useMutation({
    mutationFn: async () => {
      // update only rows the user owns or broadcast (RLS restricts UPDATE to own rows)
      if (!user) return;
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    },
    onSuccess: () => { toast.success("All read"); qc.invalidateQueries({ queryKey: ["notifications-list"] }); qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] }); },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Recent activity and system alerts."
        actions={<Button variant="outline" onClick={() => markAll.mutate()}><CheckCheck className="mr-1.5 h-4 w-4" />Mark all as read</Button>}
      />
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (rows ?? []).length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
      ) : (
        <div className="space-y-2">
          {rows!.map((n: any) => (
            <div key={n.id} className={`glass-card flex items-start gap-4 rounded-xl p-4 ${!n.is_read ? "border-l-4 border-l-primary" : ""}`}>
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{n.title}</h4>
                  {n.category && <Badge variant="secondary" className="text-[10px] uppercase">{n.category}</Badge>}
                  {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
                {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{format(new Date(n.created_at), "PPp")}</p>
              </div>
              {!n.is_read && n.user_id && (
                <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}><Check className="h-4 w-4" /></Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
