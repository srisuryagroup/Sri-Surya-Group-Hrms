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
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, FolderKanban, Pencil, Trash2, Loader2, Calendar, IndianRupee, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projects — Sri Surya Group HRMS" }] }),
  component: ProjectsPage,
});

type Project = {
  id?: string; name: string; client_name?: string | null; description?: string | null;
  budget?: number | null; start_date?: string | null; end_date?: string | null;
  priority?: string; status?: string; progress?: number;
};

// Cast to bypass generated types (tables added post-gen)
const db = supabase as any;

function ProjectsPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignFor, setAssignFor] = useState<any | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => ((await supabase.from("projects").select("*").order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const { data: allAssignments } = useQuery({
    queryKey: ["project_assignments_all"],
    queryFn: async () => ((await db.from("project_assignments").select("id, project_id, assignee_type, assignee_id, role")).data ?? []) as any[],
  });

  const upsertMut = useMutation({
    mutationFn: async (p: Partial<Project>) => {
      const c: any = { ...p };
      Object.keys(c).forEach((k) => { if (c[k] === "") c[k] = null; });
      if (typeof c.budget === "string") c.budget = c.budget ? Number(c.budget) : null;
      if (typeof c.progress === "string") c.progress = Number(c.progress);
      if (c.id) {
        const { error } = await supabase.from("projects").update(c).eq("id", c.id);
        if (error) throw error;
      } else {
        delete c.id;
        const { error } = await supabase.from("projects").insert(c);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("projects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (rows ?? []).filter((r: any) => statusFilter === "all" || r.status === statusFilter);

  const countAssignees = (pid: string) =>
    (allAssignments ?? []).filter((a: any) => a.project_id === pid).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Track client projects, timelines, budgets and progress."
        actions={
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {isManager && (
              <Button onClick={() => { setEditing({ name: "", status: "planning", priority: "medium", progress: 0 }); setOpen(true); }} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                <Plus className="mr-1.5 h-4 w-4" />New Project
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects" description="Create your first project to start tracking." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p: any) => (
            <Card key={p.id} className="glass-card group border-border/40 transition hover:-translate-y-0.5 hover:surya-glow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase text-muted-foreground">{p.project_code}</div>
                    <h3 className="mt-0.5 truncate text-base font-semibold">{p.name}</h3>
                    {p.client_name && <p className="text-xs text-muted-foreground">for {p.client_name}</p>}
                  </div>
                  <PriorityBadge v={p.priority} />
                </div>
                {p.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress ?? 0} className="h-2" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <IndianRupee className="h-3.5 w-3.5" />{p.budget ? `${(Number(p.budget) / 100000).toFixed(1)}L` : "—"}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />{p.end_date ? format(new Date(p.end_date), "MMM yyyy") : "—"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignFor(p)}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition"
                  >
                    <Users className="h-3.5 w-3.5" />{countAssignees(p.id)} assigned
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                  <StatusPill v={p.status} />
                  {isManager && (
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => setAssignFor(p)} title="Assign team"><Users className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>Tasks and assignments under this project will also be removed.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMut.mutate(p.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); upsertMut.mutate(editing); }} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <F label="Project name" required full><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></F>
              <F label="Client name"><Input value={editing.client_name ?? ""} onChange={(e) => setEditing({ ...editing, client_name: e.target.value })} /></F>
              <F label="Budget (₹)"><Input type="number" value={editing.budget ?? ""} onChange={(e) => setEditing({ ...editing, budget: e.target.value as any })} /></F>
              <F label="Start date"><Input type="date" value={editing.start_date ?? ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} /></F>
              <F label="End date"><Input type="date" value={editing.end_date ?? ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} /></F>
              <F label="Priority">
                <Select value={editing.priority ?? "medium"} onValueChange={(v) => setEditing({ ...editing, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Status">
                <Select value={editing.status ?? "planning"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="on_hold">On hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Progress %"><Input type="number" min="0" max="100" value={editing.progress ?? 0} onChange={(e) => setEditing({ ...editing, progress: Number(e.target.value) })} /></F>
              <F label="Description" full><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></F>
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={upsertMut.isPending} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                  {upsertMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing.id ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AssignTeamDialog
        project={assignFor}
        canEdit={isManager}
        onClose={() => setAssignFor(null)}
      />
    </div>
  );
}

function AssignTeamDialog({ project, canEdit, onClose }: { project: any | null; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"employee" | "freelancer">("employee");
  const [pickId, setPickId] = useState("");
  const [role, setRole] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => ((await supabase.from("employees").select("id, full_name").order("full_name")).data ?? []) as any[],
    enabled: !!project,
  });
  const { data: freelancers } = useQuery({
    queryKey: ["freelancers-min"],
    queryFn: async () => ((await supabase.from("freelancers").select("id, full_name").order("full_name")).data ?? []) as any[],
    enabled: !!project,
  });
  const { data: assignments } = useQuery({
    queryKey: ["project_assignments", project?.id],
    queryFn: async () => ((await db.from("project_assignments").select("*").eq("project_id", project.id)).data ?? []) as any[],
    enabled: !!project,
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!pickId) throw new Error("Pick a person");
      const { error } = await db.from("project_assignments").insert({
        project_id: project.id, assignee_type: type, assignee_id: pickId, role: role || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_assignments", project.id] });
      qc.invalidateQueries({ queryKey: ["project_assignments_all"] });
      setPickId(""); setRole(""); toast.success("Assigned");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("project_assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_assignments", project.id] });
      qc.invalidateQueries({ queryKey: ["project_assignments_all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const nameOf = (a: any) => {
    const list = a.assignee_type === "employee" ? employees : freelancers;
    return list?.find((x: any) => x.id === a.assignee_id)?.full_name ?? a.assignee_id.slice(0, 8);
  };

  const pool = type === "employee" ? (employees ?? []) : (freelancers ?? []);
  const assignedIds = new Set((assignments ?? []).filter((a: any) => a.assignee_type === type).map((a: any) => a.assignee_id));

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Team — {project?.name}</DialogTitle>
          <DialogDescription>Assign employees and freelancers to this project.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {(assignments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No one assigned yet.</p>
          ) : (assignments ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 p-2 pl-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{nameOf(a)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {a.assignee_type}{a.role ? ` • ${a.role}` : ""}
                </div>
              </div>
              {canEdit && (
                <Button size="icon" variant="ghost" onClick={() => removeMut.mutate(a.id)} className="text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="grid grid-cols-1 gap-2 border-t border-border/40 pt-3 sm:grid-cols-[120px_1fr_1fr_auto]">
            <Select value={type} onValueChange={(v) => { setType(v as any); setPickId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="freelancer">Freelancer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pickId} onValueChange={setPickId}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {pool.filter((x: any) => !assignedIds.has(x.id)).map((x: any) => (
                  <SelectItem key={x.id} value={x.id}>{x.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Role (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
            <Button onClick={() => addMut.mutate()} disabled={addMut.isPending || !pickId} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PriorityBadge({ v }: { v: string }) {
  const m: Record<string, string> = { low: "bg-muted text-muted-foreground", medium: "bg-info/15 text-info", high: "bg-warning/15 text-warning", urgent: "bg-destructive/15 text-destructive" };
  return <Badge variant="secondary" className={m[v] ?? ""}>{v}</Badge>;
}
function StatusPill({ v }: { v: string }) {
  const m: Record<string, string> = { planning: "bg-info/15 text-info", in_progress: "bg-primary/15 text-primary", on_hold: "bg-warning/15 text-warning", completed: "bg-success/15 text-success", cancelled: "bg-destructive/15 text-destructive" };
  return <Badge variant="secondary" className={m[v] ?? ""}>{v?.replace("_", " ")}</Badge>;
}
function F({ label, required, full, children }: any) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
