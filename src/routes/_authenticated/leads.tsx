import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { format, isBefore, isToday, parseISO } from "date-fns";
import { Plus, Pencil, Trash2, Loader2, Search, Phone, MessageCircle, Mail, MapPin, CalendarClock, Contact } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkDomainExpiry } from "@/lib/lead-domain.functions";
import { useServerFn } from "@tanstack/react-start";
import { Globe, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Customer Leads — Sri Surya Group HRMS" },
      { name: "description", content: "Track customer leads, follow-ups and conversions." },
      { property: "og:title", content: "Customer Leads — Sri Surya Group HRMS" },
      { property: "og:description", content: "Track customer leads, follow-ups and conversions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadsPage,
});

const db = supabase as any;

const STATUSES = [
  ["new", "New"], ["contacted", "Contacted"], ["interested", "Interested"],
  ["follow_up", "Follow-up"], ["converted", "Converted"], ["lost", "Lost"],
] as const;
const SOURCES = ["Website", "Walk-in", "Referral", "Social Media", "WhatsApp", "Phone Call", "Event", "Other"];
const STATUS_CLS: Record<string, string> = {
  new: "bg-info/15 text-info", contacted: "bg-primary/15 text-primary", interested: "bg-warning/15 text-warning",
  follow_up: "bg-warning/15 text-warning", converted: "bg-success/15 text-success", lost: "bg-destructive/15 text-destructive",
};

const phone = z.string().trim().max(20).regex(/^[+\d\s-]*$/, "Digits only");
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  mobile: phone, whatsapp: phone,
  email: z.union([z.literal(""), z.string().trim().email("Invalid email").max(255)]),
  location: z.string().trim().max(200), interest: z.string().trim().max(200), source: z.string().max(50),
  follow_up_date: z.string(), status: z.enum(["new", "contacted", "interested", "follow_up", "converted", "lost"]),
  notes: z.string().trim().max(2000),
});
type Lead = z.infer<typeof schema> & { id?: string };
const blank: Lead = { name: "", mobile: "", whatsapp: "", email: "", location: "", interest: "", source: "", follow_up_date: "", status: "new", notes: "" };

function LeadsPage() {
  const { user, isManager } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Lead | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["leads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: offerings } = useQuery({
    queryKey: ["offerings-names"],
    queryFn: async () => ((await db.from("offerings").select("name").eq("is_active", true).order("name")).data ?? []) as any[],
  });

  const save = useMutation({
    mutationFn: async (l: Lead) => {
      const parsed = schema.safeParse(l);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const c: any = { ...parsed.data };
      Object.keys(c).forEach((k) => { if (c[k] === "") c[k] = null; });
      c.status = parsed.data.status;
      if (l.id) {
        const { error } = await db.from("leads").update(c).eq("id", l.id);
        if (error) throw error;
      } else {
        c.owner_id = user!.id;
        c.owner_name = (user?.user_metadata as any)?.full_name ?? user?.email ?? null;
        const { error } = await db.from("leads").insert(c);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); setEditing(null); toast.success("Lead saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("leads").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isDue = (r: any) => r.follow_up_date && !["converted", "lost"].includes(r.status) && !isBefore(today, parseISO(r.follow_up_date)) ;
  const term = q.trim().toLowerCase();
  const filtered = (rows ?? []).filter((r) =>
    (status === "all" || r.status === status) &&
    (view === "all" || (view === "mine" ? r.owner_id === user?.id : isDue(r))) &&
    (!term || [r.name, r.mobile, r.whatsapp, r.email, r.location, r.interest, r.owner_name].some((v) => v?.toLowerCase().includes(term))),
  );
  const dueCount = (rows ?? []).filter(isDue).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Leads"
        description={isManager ? "All team leads, follow-ups and conversions." : "Your customer leads and follow-ups."}
        actions={
          <Button onClick={() => setEditing({ ...blank })} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" />Add Customer
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, phone, email, location…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={view} onValueChange={setView}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leads</SelectItem>
            {isManager && <SelectItem value="mine">My leads</SelectItem>}
            <SelectItem value="due">Follow-ups due ({dueCount})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Contact} title="No leads" description="Add your first customer to start tracking follow-ups." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const d = r.follow_up_date ? parseISO(r.follow_up_date) : null;
            const overdue = d && isDue(r) && !isToday(d);
            return (
              <Card key={r.id} className="glass-card group border-border/40">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{r.name}</h3>
                      {r.interest && <p className="truncate text-xs text-muted-foreground">{r.interest}</p>}
                    </div>
                    <Badge variant="secondary" className={STATUS_CLS[r.status] ?? ""}>{STATUSES.find((s) => s[0] === r.status)?.[1] ?? r.status}</Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {r.mobile && <a href={`tel:${r.mobile}`} className="flex items-center gap-1.5 hover:text-foreground"><Phone className="h-3.5 w-3.5" />{r.mobile}</a>}
                    {r.whatsapp && <a href={`https://wa.me/${encodeURIComponent(r.whatsapp.replace(/\D/g, ""))}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground"><MessageCircle className="h-3.5 w-3.5" />{r.whatsapp}</a>}
                    {r.email && <a href={`mailto:${r.email}`} className="flex items-center gap-1.5 truncate hover:text-foreground"><Mail className="h-3.5 w-3.5" />{r.email}</a>}
                    {r.location && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{r.location}</div>}
                  </div>
                  {r.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{r.notes}</p>}
                  <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs">
                    <span className={`flex items-center gap-1.5 ${overdue ? "text-destructive" : d && isToday(d) ? "text-warning" : "text-muted-foreground"}`}>
                      <CalendarClock className="h-3.5 w-3.5" />
                      {d ? `${overdue ? "Overdue · " : isToday(d) ? "Today · " : ""}${format(d, "dd MMM yyyy")}` : "No follow-up"}
                    </span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...blank, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ""])) } as Lead)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete lead?</AlertDialogTitle><AlertDialogDescription>This removes {r.name} permanently.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(r.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {isManager && r.owner_name && <div className="text-[11px] text-muted-foreground">Added by {r.owner_name}</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit customer" : "Add customer"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <F label="Customer name" required full><Input value={editing.name} maxLength={120} required onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></F>
              <F label="Mobile"><Input type="tel" maxLength={20} value={editing.mobile} onChange={(e) => setEditing({ ...editing, mobile: e.target.value })} /></F>
              <F label="WhatsApp"><Input type="tel" maxLength={20} value={editing.whatsapp} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} /></F>
              <F label="Email"><Input type="email" maxLength={255} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></F>
              <F label="Location"><Input maxLength={200} value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></F>
              <F label="Interested product / service">
                <Input list="lead-offerings" maxLength={200} value={editing.interest} onChange={(e) => setEditing({ ...editing, interest: e.target.value })} />
                <datalist id="lead-offerings">{(offerings ?? []).map((o: any) => <option key={o.name} value={o.name} />)}</datalist>
              </F>
              <F label="Lead source">
                <Select value={editing.source || undefined} onValueChange={(v) => setEditing({ ...editing, source: v })}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Follow-up date"><Input type="date" value={editing.follow_up_date} onChange={(e) => setEditing({ ...editing, follow_up_date: e.target.value })} /></F>
              <F label="Status">
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v as Lead["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Notes" full><Textarea rows={3} maxLength={2000} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></F>
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={save.isPending} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing.id ? "Save" : "Add customer"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, required, full, children }: any) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
