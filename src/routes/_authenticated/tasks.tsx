import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Plus, CheckSquare, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Sri Surya Group HRMS" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => (await supabase.from("projects").select("id,name").order("name")).data ?? [],
  });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => ((await supabase.from("tasks").select("*, projects(name)").order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return (rows ?? []).filter((r: any) => {
      if (statusF !== "all" && r.status !== statusF) return false;
      if (!s) return true;
      return r.name?.toLowerCase().includes(s) || r.assignee_name?.toLowerCase().includes(s);
    });
  }, [rows, q, statusF]);

  const upsertMut = useMutation({
    mutationFn: async (p: any) => {
      const c: any = { ...p };
      Object.keys(c).forEach((k) => { if (c[k] === "") c[k] = null; });
      delete c.projects;
      if (c.id) { const { error } = await supabase.from("tasks").update(c).eq("id", c.id); if (error) throw error; }
      else { delete c.id; const { error } = await supabase.from("tasks").insert(c); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Deleted"); },
  });
  const quickStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Assign, track and complete work across all projects."
        actions={isManager && (
          <Button onClick={() => { setEditing({ name: "", status: "pending", priority: "medium" }); setOpen(true); }} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" />New Task
          </Button>
        )}
      />
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No tasks" description="Create a task to start tracking work." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t: any) => (
                  <TableRow key={t.id} className="border-border/40">
                    <TableCell><div className="font-medium">{t.name}</div>{t.description && <div className="line-clamp-1 text-xs text-muted-foreground">{t.description}</div>}</TableCell>
                    <TableCell className="text-sm">{t.projects?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.assignee_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.due_date ? format(new Date(t.due_date), "MMM d") : "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className={priorityCls(t.priority)}>{t.priority}</Badge></TableCell>
                    <TableCell>
                      {isManager ? (
                        <Select value={t.status} onValueChange={(v) => quickStatus.mutate({ id: t.id, status: v })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="on_hold">On hold</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : <Badge variant="secondary" className={statusCls(t.status)}>{t.status.replace("_", " ")}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {isManager && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete task?</AlertDialogTitle><AlertDialogDescription>{t.name}</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMut.mutate(t.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); upsertMut.mutate(editing); }} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <F label="Task name" required full><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></F>
              <F label="Project" full>
                <Select value={editing.project_id ?? ""} onValueChange={(v) => setEditing({ ...editing, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Assignee name"><Input value={editing.assignee_name ?? ""} onChange={(e) => setEditing({ ...editing, assignee_name: e.target.value })} /></F>
              <F label="Due date"><Input type="date" value={editing.due_date ?? ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} /></F>
              <F label="Priority">
                <Select value={editing.priority ?? "medium"} onValueChange={(v) => setEditing({ ...editing, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
                </Select>
              </F>
              <F label="Status">
                <Select value={editing.status ?? "pending"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="on_hold">On hold</SelectItem></SelectContent>
                </Select>
              </F>
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
    </div>
  );
}

const priorityCls = (v: string) => ({ low: "bg-muted text-muted-foreground", medium: "bg-info/15 text-info", high: "bg-warning/15 text-warning", urgent: "bg-destructive/15 text-destructive" } as Record<string, string>)[v] ?? "";
const statusCls = (v: string) => ({ pending: "bg-warning/15 text-warning", in_progress: "bg-info/15 text-info", completed: "bg-success/15 text-success", on_hold: "bg-muted text-muted-foreground" } as Record<string, string>)[v] ?? "";
function F({ label, required, full, children }: any) {
  return <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}><Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>{children}</div>;
}
