import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Sri Surya Group HRMS" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("*").maybeSingle()).data,
  });

  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  const saveMut = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("company_settings").update(p).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-settings"] }); toast.success("Settings saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure company profile and workspace preferences." />
      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Company profile</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !form ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); saveMut.mutate(form); }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <F label="Company name" required full><Input value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} disabled={!isAdmin} required /></F>
              <F label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!isAdmin} /></F>
              <F label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!isAdmin} /></F>
              <F label="Timezone"><Input value={form.timezone ?? ""} onChange={(e) => setForm({ ...form, timezone: e.target.value })} disabled={!isAdmin} /></F>
              <F label="Currency"><Input value={form.currency ?? ""} onChange={(e) => setForm({ ...form, currency: e.target.value })} disabled={!isAdmin} /></F>
              <F label="Working hours"><Input value={form.working_hours ?? ""} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} disabled={!isAdmin} /></F>
              <F label="Logo URL" full><Input value={form.logo_url ?? ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} disabled={!isAdmin} /></F>
              <F label="Office address" full><Textarea rows={2} value={form.office_address ?? ""} onChange={(e) => setForm({ ...form, office_address: e.target.value })} disabled={!isAdmin} /></F>
              <F label="Business information" full><Textarea rows={3} value={form.business_info ?? ""} onChange={(e) => setForm({ ...form, business_info: e.target.value })} disabled={!isAdmin} /></F>
              {isAdmin && (
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={saveMut.isPending} className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
                    {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
                  </Button>
                </div>
              )}
              {!isAdmin && <p className="sm:col-span-2 text-xs text-muted-foreground">Only Super Admin can change company settings.</p>}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, required, full, children }: any) {
  return <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}><Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>{children}</div>;
}
