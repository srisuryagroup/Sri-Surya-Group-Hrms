import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyEmployee, useMyFreelancer } from "@/hooks/use-my-record";

export const Route = createFileRoute("/_authenticated/my-work")({
  head: () => ({
    meta: [
      { title: "My Work — Sri Surya Group HRMS" },
      {
        name: "description",
        content: "Submit daily work updates and track the progress you have reported.",
      },
      { property: "og:title", content: "My Work — Sri Surya Group HRMS" },
      {
        property: "og:description",
        content: "Submit daily work updates and track reported progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyWorkPage,
});

const STATUSES = ["in_progress", "submitted", "completed", "blocked"] as const;

function MyWorkPage() {
  const employeeQuery = useMyEmployee();
  const freelancerQuery = useMyFreelancer();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const freelancer = freelancerQuery.data ?? null;
  const employee = employeeQuery.data ?? null;
  const linked = freelancer ?? employee;
  const loadingMe = employeeQuery.isLoading || freelancerQuery.isLoading;

  const ownerFilter = freelancer
    ? { column: "freelancer_id" as const, id: freelancer.id }
    : employee
      ? { column: "employee_id" as const, id: employee.id }
      : null;

  const { data: projects } = useQuery({
    queryKey: ["my-work-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: updates, isLoading } = useQuery({
    queryKey: ["work-updates", ownerFilter?.column, ownerFilter?.id],
    enabled: !!ownerFilter,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_updates")
        .select("id,title,details,status,hours_spent,work_date,project_id,projects(name)")
        .eq(ownerFilter!.column, ownerFilter!.id)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    title: "",
    details: "",
    status: "submitted",
    hours_spent: "",
    work_date: new Date().toISOString().slice(0, 10),
    project_id: "none",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!ownerFilter) throw new Error("No linked record");
      const { error } = await supabase.from("work_updates").insert({
        title: form.title.trim(),
        details: form.details.trim() || null,
        status: form.status,
        hours_spent: form.hours_spent ? Number(form.hours_spent) : null,
        work_date: form.work_date,
        project_id: form.project_id === "none" ? null : form.project_id,
        [ownerFilter.column]: ownerFilter.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work update submitted");
      setOpen(false);
      setForm({
        title: "",
        details: "",
        status: "submitted",
        hours_spent: "",
        work_date: new Date().toISOString().slice(0, 10),
        project_id: "none",
      });
      qc.invalidateQueries({ queryKey: ["work-updates"] });
      qc.invalidateQueries({ queryKey: ["freelancer-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not submit update"),
  });

  if (loadingMe) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Work" description="Your submitted work updates." />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Work" description="Your submitted work updates." />
        <EmptyState
          icon={Send}
          title="No profile linked yet"
          description="Your account is not linked to an employee or freelancer record, so work updates cannot be submitted. Ask HR to create your record using this same email address."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Work"
        description="Submit daily work updates and review what you have reported."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                <Plus className="mr-1.5 h-4 w-4" /> New Work Update
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Work Update</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="What did you work on?"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Details</Label>
                  <Textarea
                    value={form.details}
                    rows={4}
                    onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                    placeholder="Describe the progress made"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Work date</Label>
                    <Input
                      type="date"
                      value={form.work_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, work_date: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hours spent</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.hours_spent}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, hours_spent: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Project</Label>
                    <Select
                      value={form.project_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {(projects ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => create.mutate()}
                  disabled={create.isPending || !form.title.trim()}
                  className="bg-gradient-surya text-primary-foreground hover:opacity-90"
                >
                  {create.isPending && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Work Updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))
          ) : (updates ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No work updates submitted yet. Use “New Work Update” to add your first one.
            </p>
          ) : (
            (updates ?? []).map((u) => {
              const project = Array.isArray(u.projects) ? u.projects[0] : u.projects;
              return (
                <div
                  key={u.id}
                  className="rounded-lg border border-border/40 bg-card/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{u.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {u.work_date}
                        {project?.name ? ` · ${project.name}` : ""}
                        {u.hours_spent ? ` · ${Number(u.hours_spent)}h` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                      {(u.status ?? "").replaceAll("_", " ")}
                    </Badge>
                  </div>
                  {u.details && (
                    <p className="mt-2 text-sm text-muted-foreground">{u.details}</p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
