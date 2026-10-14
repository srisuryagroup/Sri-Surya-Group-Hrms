import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ShoppingBag, Plus, Loader2, Pencil, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyFreelancer } from "@/hooks/use-my-record";
import { inr } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — Sri Surya Group HRMS" },
      { name: "description", content: "Book Sri Surya Group products and services and track commissions." },
      { property: "og:title", content: "Bookings — Sri Surya Group HRMS" },
      { property: "og:description", content: "Book Sri Surya Group products and services and track commissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingsPage,
});

const db = supabase as any;

export const CATEGORIES: Record<string, string> = {
  website_design: "Website Design",
  software_development: "Software Development",
  digital_marketing: "Digital Marketing",
  it_services: "IT Services",
  physical_product: "Physical Products",
};
const STATUSES = ["pending", "approved", "in_progress", "completed", "rejected", "cancelled"];
const statusCls: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-info/15 text-info",
  in_progress: "bg-info/15 text-info",
  completed: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const bookingSchema = z.object({
  offering_id: z.string().uuid("Choose a product or service"),
  freelancer_id: z.string().uuid("Choose a freelancer"),
  client_name: z.string().trim().min(2, "Client name is required").max(120),
  client_contact: z.string().trim().max(120).optional().nullable(),
  deal_value: z.coerce.number().min(0, "Deal value cannot be negative"),
  notes: z.string().trim().max(1000).optional().nullable(),
});
const offeringSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  category: z.enum(Object.keys(CATEGORIES) as [string, ...string[]]),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.coerce.number().min(0).nullable().optional(),
  commission_mode: z.enum(["percentage", "fixed"]),
  commission_value: z.coerce.number().min(0, "Commission cannot be negative"),
  is_active: z.boolean(),
});

const commissionLabel = (o: any) =>
  o ? (o.commission_mode === "fixed" ? inr(o.commission_value) : `${Number(o.commission_value)}%`) : "—";

function BookingsPage() {
  const { roles } = useAuth();
  const canManage = roles.includes("super_admin") || roles.includes("hr_manager");
  const { data: me } = useMyFreelancer();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [offerEdit, setOfferEdit] = useState<any | null>(null);

  const offeringsQ = useQuery({
    queryKey: ["offerings"],
    queryFn: async () => {
      const { data, error } = await db.from("offerings").select("*").order("category").order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const bookingsQ = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await db
        .from("bookings")
        .select("*, offerings(name,category,commission_mode,commission_value), freelancers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const freelancersQ = useQuery({
    queryKey: ["freelancers-min"],
    enabled: canManage,
    queryFn: async () => (await supabase.from("freelancers").select("id, full_name").order("full_name")).data ?? [],
  });

  const rows = bookingsQ.data ?? [];
  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return rows.filter((r) =>
      (statusF === "all" || r.status === statusF) &&
      (!s || [r.client_name, r.offerings?.name, r.freelancers?.full_name].some((v: string) => v?.toLowerCase().includes(s))),
    );
  }, [rows, q, statusF]);

  const active = rows.filter((r) => ["approved", "in_progress", "completed"].includes(r.status));
  const earned = active.reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);
  const paid = active.filter((r) => r.payment_status === "paid").reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);

  const invalidate = () => {
    ["bookings", "commissions", "freelancer-dashboard", "earnings"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const saveBooking = useMutation({
    mutationFn: async (b: any) => {
      const r = bookingSchema.safeParse({ ...b, freelancer_id: canManage ? b.freelancer_id : me?.id });
      if (!r.success) throw new Error(r.error.issues[0].message);
      const payload: any = { ...r.data, client_contact: r.data.client_contact || null, notes: r.data.notes || null };
      if (b.id) {
        const { error } = await db.from("bookings").update(payload).eq("id", b.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("bookings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); setEditing(null); toast.success("Booking saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchBooking = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await db.from("bookings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Booking updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveOffering = useMutation({
    mutationFn: async (o: any) => {
      const r = offeringSchema.safeParse({ ...o, price: o.price === "" || o.price == null ? null : o.price, is_active: o.is_active ?? true });
      if (!r.success) throw new Error(r.error.issues[0].message);
      const payload = { ...r.data, description: r.data.description || null };
      const { error } = o.id
        ? await db.from("offerings").update(payload).eq("id", o.id)
        : await db.from("offerings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["offerings"] }); setOfferEdit(null); toast.success("Catalog updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const offerings = offeringsQ.data ?? [];
  const activeOfferings = offerings.filter((o) => o.is_active);
  const selectedOffering = offerings.find((o) => o.id === editing?.offering_id);
  const preview = selectedOffering
    ? selectedOffering.commission_mode === "fixed"
      ? Number(selectedOffering.commission_value)
      : (Number(editing?.deal_value || 0) * Number(selectedOffering.commission_value)) / 100
    : 0;
  const canBook = canManage || !!me;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description={canManage
          ? "Review freelancer bookings, approve jobs and pay commissions."
          : "Book Sri Surya Group products and services for your clients and earn commission."}
        actions={canBook && (
          <Button onClick={() => setEditing({ deal_value: "" })} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" />New Booking
          </Button>
        )}
      />

      {!canManage && !me && (
        <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
          No freelancer record is linked to your account yet, so you can't book jobs.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Earned commission" value={inr(earned)} icon={Wallet} tone="primary" />
        <StatCard label="Pending payment" value={inr(earned - paid)} icon={Clock} tone="warning" />
        <StatCard label="Paid" value={inr(paid)} icon={CheckCircle2} tone="success" />
      </div>

      <Tabs defaultValue="bookings">
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="bookings">Bookings ({rows.length})</TabsTrigger>
          <TabsTrigger value="catalog">Products & Services</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="mt-4 space-y-4">
          <div className="glass-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search client, service or freelancer…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="glass-card overflow-hidden rounded-2xl">
            {bookingsQ.isLoading ? (
              <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : bookingsQ.error ? (
              <EmptyState icon={ShoppingBag} title="Couldn't load bookings" description={(bookingsQ.error as Error).message} />
            ) : filtered.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="No bookings yet" description={canBook ? "Create a booking to get started." : "Bookings will appear here."} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead>Client</TableHead>
                      <TableHead>Product / Service</TableHead>
                      {canManage && <TableHead>Freelancer</TableHead>}
                      <TableHead>Deal value</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id} className="border-border/40">
                        <TableCell>
                          <div className="font-medium">{r.client_name}</div>
                          {r.client_contact && <div className="text-xs text-muted-foreground">{r.client_contact}</div>}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{r.offerings?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{CATEGORIES[r.offerings?.category] ?? ""}</div>
                        </TableCell>
                        {canManage && <TableCell className="text-sm">{r.freelancers?.full_name ?? "—"}</TableCell>}
                        <TableCell className="text-sm">{inr(r.deal_value)}</TableCell>
                        <TableCell className="text-sm font-medium">{inr(r.commission_amount)}</TableCell>
                        <TableCell>
                          {canManage ? (
                            <Select value={r.status} onValueChange={(v) => patchBooking.mutate({ id: r.id, patch: { status: v } })}>
                              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary" className={`capitalize ${statusCls[r.status] ?? ""}`}>{r.status.replace("_", " ")}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={r.payment_status === "paid" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>
                            {r.payment_status === "paid" ? `Paid${r.paid_on ? ` ${r.paid_on}` : ""}` : "Unpaid"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canManage && r.payment_status !== "paid" && ["approved", "in_progress", "completed"].includes(r.status) && (
                              <Button size="sm" variant="outline" onClick={() => patchBooking.mutate({ id: r.id, patch: { payment_status: "paid" } })}>Mark paid</Button>
                            )}
                            {(canManage || r.status === "pending") && r.payment_status !== "paid" && (
                              <Button size="icon" variant="ghost" aria-label="Edit booking" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                            )}
                            {!canManage && r.status === "pending" && (
                              <Button size="sm" variant="ghost" className="text-destructive"
                                onClick={() => { if (confirm("Cancel this booking?")) patchBooking.mutate({ id: r.id, patch: { status: "cancelled" } }); }}>
                                Cancel
                              </Button>
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
        </TabsContent>

        <TabsContent value="catalog" className="mt-4 space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setOfferEdit({ category: "website_design", commission_mode: "percentage", commission_value: "", is_active: true })}>
                <Plus className="mr-1.5 h-4 w-4" />Add product / service
              </Button>
            </div>
          )}
          {offeringsQ.isLoading ? (
            <Skeleton className="h-32" />
          ) : offerings.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No products or services yet"
              description={canManage ? "Add your products and services so freelancers can book them." : "Admin/HR will add products and services here."} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {offerings.map((o) => (
                <div key={o.id} className="glass-card space-y-2 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{o.name}</h3>
                      <p className="text-xs text-muted-foreground">{CATEGORIES[o.category]}</p>
                    </div>
                    {!o.is_active && <Badge variant="secondary">Inactive</Badge>}
                    {canManage && <Button size="icon" variant="ghost" aria-label="Edit product" onClick={() => setOfferEdit(o)}><Pencil className="h-4 w-4" /></Button>}
                  </div>
                  {o.description && <p className="line-clamp-3 text-sm text-muted-foreground">{o.description}</p>}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price</span><span>{o.price != null ? inr(o.price) : "On quote"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Commission</span><span className="font-semibold text-primary">{commissionLabel(o)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit booking" : "New booking"}</DialogTitle></DialogHeader>
          {editing && (
            <form id="booking-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveBooking.mutate(editing); }}>
              <div className="space-y-1.5">
                <Label>Product / service</Label>
                <Select value={editing.offering_id ?? ""} onValueChange={(v) => setEditing({ ...editing, offering_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose what the client is buying" /></SelectTrigger>
                  <SelectContent>
                    {activeOfferings.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name} · {CATEGORIES[o.category]} · {commissionLabel(o)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeOfferings.length === 0 && <p className="text-xs text-muted-foreground">No products or services are available yet.</p>}
              </div>
              {canManage && (
                <div className="space-y-1.5">
                  <Label>Freelancer</Label>
                  <Select value={editing.freelancer_id ?? ""} onValueChange={(v) => setEditing({ ...editing, freelancer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select freelancer" /></SelectTrigger>
                    <SelectContent>{(freelancersQ.data ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="b-client">Client name</Label>
                  <Input id="b-client" value={editing.client_name ?? ""} onChange={(e) => setEditing({ ...editing, client_name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-contact">Client phone / email</Label>
                  <Input id="b-contact" value={editing.client_contact ?? ""} onChange={(e) => setEditing({ ...editing, client_contact: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-value">Deal value (₹)</Label>
                <Input id="b-value" type="number" min="0" step="0.01" value={editing.deal_value ?? ""} onChange={(e) => setEditing({ ...editing, deal_value: e.target.value })} required />
                {selectedOffering && <p className="text-xs text-muted-foreground">Estimated commission: <span className="font-semibold text-primary">{inr(preview)}</span></p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-notes">Notes</Label>
                <Textarea id="b-notes" rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </form>
          )}
          <DialogFooter>
            <Button type="submit" form="booking-form" disabled={saveBooking.isPending} className="bg-gradient-surya text-primary-foreground hover:opacity-90">
              {saveBooking.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing?.id ? "Save" : "Submit booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!offerEdit} onOpenChange={(o) => !o && setOfferEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{offerEdit?.id ? "Edit product / service" : "Add product / service"}</DialogTitle></DialogHeader>
          {offerEdit && (
            <form id="offer-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveOffering.mutate(offerEdit); }}>
              <div className="space-y-1.5">
                <Label htmlFor="o-name">Name</Label>
                <Input id="o-name" value={offerEdit.name ?? ""} onChange={(e) => setOfferEdit({ ...offerEdit, name: e.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={offerEdit.category} onValueChange={(v) => setOfferEdit({ ...offerEdit, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-price">Price (₹, optional)</Label>
                  <Input id="o-price" type="number" min="0" value={offerEdit.price ?? ""} onChange={(e) => setOfferEdit({ ...offerEdit, price: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Commission type</Label>
                  <Select value={offerEdit.commission_mode} onValueChange={(v) => setOfferEdit({ ...offerEdit, commission_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage of deal</SelectItem>
                      <SelectItem value="fixed">Fixed amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-cv">{offerEdit.commission_mode === "fixed" ? "Commission (₹)" : "Commission (%)"}</Label>
                  <Input id="o-cv" type="number" min="0" step="0.01" value={offerEdit.commission_value ?? ""} onChange={(e) => setOfferEdit({ ...offerEdit, commission_value: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-desc">Description</Label>
                <Textarea id="o-desc" rows={3} value={offerEdit.description ?? ""} onChange={(e) => setOfferEdit({ ...offerEdit, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={offerEdit.is_active ?? true} onCheckedChange={(c) => setOfferEdit({ ...offerEdit, is_active: c })} />
                Available for booking
              </label>
            </form>
          )}
          <DialogFooter>
            <Button type="submit" form="offer-form" disabled={saveOffering.isPending} className="bg-gradient-surya text-primary-foreground hover:opacity-90">
              {saveOffering.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
