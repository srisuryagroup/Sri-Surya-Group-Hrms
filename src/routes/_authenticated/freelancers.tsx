import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Briefcase, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/freelancers")({
  head: () => ({ meta: [{ title: "Freelancers — Sri Surya Group HRMS" }] }),
  component: FreelancersPage,
});

type Freelancer = {
  id?: string;
  freelancer_code?: string;
  full_name: string;
  email: string;
  mobile?: string | null;
  skills?: string[] | null;
  experience_years?: number | null;
  hourly_rate?: number | null;
  upi_id?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  resume_url?: string | null;
  portfolio_url?: string | null;
  availability?: string;
  status?: string;
};

const empty: Partial<Freelancer> = { full_name: "", email: "", availability: "available", status: "active" };

function FreelancersPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [availFilter, setAvailFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Freelancer> | null>(null);
  const [skillsInput, setSkillsInput] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["freelancers"],
    queryFn: async () => ((await supabase.from("freelancers").select("*").order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return (rows ?? []).filter((r: any) => {
      if (availFilter !== "all" && r.availability !== availFilter) return false;
      if (!s) return true;
      return r.full_name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.freelancer_code?.toLowerCase().includes(s) || (r.skills ?? []).join(" ").toLowerCase().includes(s);
    });
  }, [rows, q, availFilter]);

  const upsertMut = useMutation({
    mutationFn: async (payload: Partial<Freelancer>) => {
      const cleaned: any = { ...payload };
      Object.keys(cleaned).forEach((k) => { if (cleaned[k] === "") cleaned[k] = null; });
      if (typeof cleaned.hourly_rate === "string") cleaned.hourly_rate = cleaned.hourly_rate ? Number(cleaned.hourly_rate) : null;
      if (typeof cleaned.experience_years === "string") cleaned.experience_years = cleaned.experience_years ? Number(cleaned.experience_years) : null;
      delete cleaned.freelancer_code;
      if (cleaned.id) {
        const { error } = await supabase.from("freelancers").update(cleaned).eq("id", cleaned.id);
        if (error) throw error;
      } else {
        delete cleaned.id;
        const { error } = await supabase.from("freelancers").insert(cleaned);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancers"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("freelancers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["freelancers"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing({ ...empty }); setSkillsInput(""); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setSkillsInput((r.skills ?? []).join(", ")); setOpen(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freelancers"
        description="Manage external talent, skills, rates and availability."
        actions={isManager && (
          <Button onClick={openNew} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" />Add Freelancer
          </Button>
        )}
      />

      <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, skills…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={availFilter} onValueChange={setAvailFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All availability</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Briefcase} title="No freelancers found" description="Add your first freelancer to build your talent bench." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Rate (₹/hr)</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id} className="border-border/40">
                    <TableCell className="font-mono text-xs">{r.freelancer_code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.skills ?? []).slice(0, 3).map((s: string) => (
                          <Badge key={s} variant="secondary" className="bg-primary/10 text-primary text-[10px]">{s}</Badge>
                        ))}
                        {(r.skills?.length ?? 0) > 3 && <span className="text-xs text-muted-foreground">+{r.skills.length - 3}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.experience_years ? `${r.experience_years} yr` : "—"}</TableCell>
                    <TableCell className="text-sm">{r.hourly_rate ? `₹${Number(r.hourly_rate).toLocaleString("en-IN")}` : "—"}</TableCell>
                    <TableCell><AvailBadge v={r.availability} /></TableCell>
                    <TableCell className="text-right">
                      {isManager && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete freelancer?</AlertDialogTitle>
                                <AlertDialogDescription>This removes {r.full_name}'s record permanently.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMut.mutate(r.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                              </AlertDialogFooter>
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit freelancer" : "Add freelancer"}</DialogTitle></DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const skills = skillsInput.split(",").map((s) => s.trim()).filter(Boolean);
                upsertMut.mutate({ ...editing, skills });
              }}
              className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2"
            >
              <F label="Full name" required><Input value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} required /></F>
              <F label="Email" required><Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} required /></F>
              <F label="Mobile"><Input value={editing.mobile ?? ""} onChange={(e) => setEditing({ ...editing, mobile: e.target.value })} /></F>
              <F label="Experience (years)"><Input type="number" step="0.5" value={editing.experience_years ?? ""} onChange={(e) => setEditing({ ...editing, experience_years: e.target.value as any })} /></F>
              <F label="Hourly rate (₹)"><Input type="number" value={editing.hourly_rate ?? ""} onChange={(e) => setEditing({ ...editing, hourly_rate: e.target.value as any })} /></F>
              <F label="UPI ID"><Input value={editing.upi_id ?? ""} onChange={(e) => setEditing({ ...editing, upi_id: e.target.value })} /></F>
              <F label="Bank name"><Input value={editing.bank_name ?? ""} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} /></F>
              <F label="Account number"><Input value={editing.account_number ?? ""} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} /></F>
              <F label="IFSC"><Input value={editing.ifsc_code ?? ""} onChange={(e) => setEditing({ ...editing, ifsc_code: e.target.value })} /></F>
              <F label="Portfolio URL"><Input value={editing.portfolio_url ?? ""} onChange={(e) => setEditing({ ...editing, portfolio_url: e.target.value })} /></F>
              <F label="Resume URL"><Input value={editing.resume_url ?? ""} onChange={(e) => setEditing({ ...editing, resume_url: e.target.value })} /></F>
              <F label="Availability">
                <Select value={editing.availability ?? "available"} onValueChange={(v) => setEditing({ ...editing, availability: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Skills (comma separated)" full><Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="React, Node.js, GraphQL" /></F>
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={upsertMut.isPending} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                  {upsertMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing.id ? "Save changes" : "Create freelancer"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AvailBadge({ v }: { v: string }) {
  const map: Record<string, string> = {
    available: "bg-success/15 text-success",
    busy: "bg-warning/15 text-warning",
    unavailable: "bg-muted text-muted-foreground",
  };
  return <Badge variant="secondary" className={map[v] ?? ""}>{v}</Badge>;
}
function F({ label, required, full, children }: any) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
