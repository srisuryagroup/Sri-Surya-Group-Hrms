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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Building2, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({ meta: [{ title: "Departments — Sri Surya Group HRMS" }] }),
  component: DepartmentsPage,
});

type Dept = { id?: string; name: string; code: string; head_name?: string | null; description?: string | null };

function DepartmentsPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Dept> | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => ((await supabase.from("departments").select("*, employees(id)").order("name")).data ?? []) as any[],
  });

  const upsertMut = useMutation({
    mutationFn: async (payload: Partial<Dept>) => {
      const cleaned: any = { ...payload };
      delete cleaned.employees;
      Object.keys(cleaned).forEach((k) => { if (cleaned[k] === "") cleaned[k] = null; });
      if (cleaned.id) {
        const { error } = await supabase.from("departments").update(cleaned).eq("id", cleaned.id);
        if (error) throw error;
      } else {
        delete cleaned.id;
        const { error } = await supabase.from("departments").insert(cleaned);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments-list"] }); qc.invalidateQueries({ queryKey: ["departments"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments-list"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Organize teams and departments across Sri Surya Group."
        actions={isManager && (
          <Button onClick={() => { setEditing({ name: "", code: "" }); setOpen(true); }} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" />Add Department
          </Button>
        )}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (rows ?? []).length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" description="Add your first department to organize your workforce." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows!.map((d: any) => (
            <Card key={d.id} className="glass-card group border-border/40 transition hover:-translate-y-0.5 hover:surya-glow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">{d.code}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{d.name}</h3>
                {d.head_name && <p className="text-xs text-muted-foreground">Head: {d.head_name}</p>}
                {d.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>}
                <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />{d.employees?.length ?? 0} members
                  </span>
                  {isManager && (
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {d.name}?</AlertDialogTitle>
                            <AlertDialogDescription>Members will be unassigned. This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMut.mutate(d.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit department" : "Add department"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); upsertMut.mutate(editing); }} className="space-y-4 pt-2">
              <div className="space-y-1.5"><Label className="text-xs">Name *</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Code *</Label>
                <Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Department head</Label>
                <Input value={editing.head_name ?? ""} onChange={(e) => setEditing({ ...editing, head_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Description</Label>
                <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <DialogFooter>
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
