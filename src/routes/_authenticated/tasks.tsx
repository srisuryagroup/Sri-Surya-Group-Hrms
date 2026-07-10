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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Plus, CheckSquare, Pencil, Trash2, Loader2, Search, MessageSquare, Paperclip, Download, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Sri Surya Group HRMS" }] }),
  component: TasksPage,
});

const db = supabase as any;

function TasksPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [detailsFor, setDetailsFor] = useState<any | null>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => (await supabase.from("projects").select("id,name").order("name")).data ?? [],
  });
  const { data: employees } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => (await supabase.from("employees").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: freelancers } = useQuery({
    queryKey: ["freelancers-min"],
    queryFn: async () => (await supabase.from("freelancers").select("id, full_name").order("full_name")).data ?? [],
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
      // Derive assignee_name from selected person for display
      if (c.assignee_type && c.assignee_id) {
        const pool = c.assignee_type === "employee" ? employees : freelancers;
        const person = pool?.find((x: any) => x.id === c.assignee_id);
        if (person) c.assignee_name = person.full_name;
      }
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
      const { error } = await supabase.from("tasks").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const pool = (editing?.assignee_type ?? "employee") === "employee" ? (employees ?? []) : (freelancers ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Assign, track and complete work across all projects."
        actions={isManager && (
          <Button onClick={() => { setEditing({ name: "", status: "pending", priority: "medium", assignee_type: "employee" }); setOpen(true); }} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
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
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setDetailsFor(t)} title="Comments & attachments">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        {isManager && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete task?</AlertDialogTitle><AlertDialogDescription>{t.name}</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMut.mutate(t.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
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
              <F label="Assignee type">
                <Select value={editing.assignee_type ?? "employee"} onValueChange={(v) => setEditing({ ...editing, assignee_type: v, assignee_id: null })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="freelancer">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Assignee">
                <Select value={editing.assignee_id ?? ""} onValueChange={(v) => setEditing({ ...editing, assignee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                  <SelectContent>{pool.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </F>
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

      <TaskDetailsDialog task={detailsFor} onClose={() => setDetailsFor(null)} />
    </div>
  );
}

function TaskDetailsDialog({ task, onClose }: { task: any | null; onClose: () => void }) {
  const { user, isManager } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: comments } = useQuery({
    queryKey: ["task_comments", task?.id],
    queryFn: async () => ((await db.from("task_comments").select("*").eq("task_id", task.id).order("created_at", { ascending: true })).data ?? []) as any[],
    enabled: !!task,
  });
  const { data: attachments } = useQuery({
    queryKey: ["task_attachments", task?.id],
    queryFn: async () => ((await db.from("task_attachments").select("*").eq("task_id", task.id).order("created_at", { ascending: false })).data ?? []) as any[],
    enabled: !!task,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (!body.trim()) throw new Error("Empty comment");
      const { error } = await db.from("task_comments").insert({
        task_id: task.id, user_id: user.id,
        author_name: user.user_metadata?.full_name || user.email,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["task_comments", task.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const delComment = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("task_comments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_comments", task.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const upload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const path = `task-attachments/${task.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("hrms-files").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await db.from("task_attachments").insert({
        task_id: task.id, uploaded_by: user.id,
        file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["task_attachments", task.id] });
      toast.success("Uploaded");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const download = async (a: any) => {
    const { data, error } = await supabase.storage.from("hrms-files").createSignedUrl(a.file_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const delAttachment = useMutation({
    mutationFn: async (a: any) => {
      await supabase.storage.from("hrms-files").remove([a.file_path]);
      const { error } = await db.from("task_attachments").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_attachments", task.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task?.name}</DialogTitle>
          <DialogDescription>Comments and file attachments.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Paperclip className="h-4 w-4" /> Attachments
            </div>
            <div className="space-y-1.5">
              {(attachments ?? []).length === 0 && <p className="text-xs text-muted-foreground">No attachments yet.</p>}
              {(attachments ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 p-2 pl-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{a.file_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.file_size ? `${(a.file_size / 1024).toFixed(0)} KB • ` : ""}
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => download(a)}><Download className="h-4 w-4" /></Button>
                  {(a.uploaded_by === user?.id || isManager) && (
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => delAttachment.mutate(a)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-1.5 text-xs hover:bg-accent">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Attach file"}
                <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} disabled={uploading} />
              </label>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" /> Comments
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(comments ?? []).length === 0 && <p className="text-xs text-muted-foreground">Be the first to comment.</p>}
              {(comments ?? []).map((c: any) => (
                <div key={c.id} className="rounded-lg border border-border/40 bg-card/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">{c.author_name ?? "User"}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</div>
                      {(c.user_id === user?.id || isManager) && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => delComment.mutate(c.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              ))}
            </div>
            {user && (
              <form onSubmit={(e) => { e.preventDefault(); addComment.mutate(); }} className="mt-2 flex gap-2">
                <Textarea rows={2} placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
                <Button type="submit" disabled={addComment.isPending || !body.trim()} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                  {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const priorityCls = (v: string) => ({ low: "bg-muted text-muted-foreground", medium: "bg-info/15 text-info", high: "bg-warning/15 text-warning", urgent: "bg-destructive/15 text-destructive" } as Record<string, string>)[v] ?? "";
const statusCls = (v: string) => ({ pending: "bg-warning/15 text-warning", in_progress: "bg-info/15 text-info", completed: "bg-success/15 text-success", on_hold: "bg-muted text-muted-foreground" } as Record<string, string>)[v] ?? "";
function F({ label, required, full, children }: any) {
  return <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}><Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>{children}</div>;
}
