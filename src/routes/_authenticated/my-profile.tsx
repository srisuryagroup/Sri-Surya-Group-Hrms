import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useMyEmployee, useMyFreelancer } from "@/hooks/use-my-record";
import { inr } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/my-profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Sri Surya Group HRMS" },
      {
        name: "description",
        content: "View and update your personal details, contact information and profile.",
      },
      { property: "og:title", content: "My Profile — Sri Surya Group HRMS" },
      {
        property: "og:description",
        content: "View and update your personal details and contact information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyProfilePage,
});

function MyProfilePage() {
  const { user, isFreelancer } = useAuth();
  const employeeQuery = useMyEmployee();
  const freelancerQuery = useMyFreelancer();

  const loading = employeeQuery.isLoading || freelancerQuery.isLoading;
  const employee = employeeQuery.data ?? null;
  const freelancer = freelancerQuery.data ?? null;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="Your personal details." />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Keep your contact details up to date."
      />

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Record type</span>
            <Badge variant="secondary" className="bg-primary/15 text-primary">
              {freelancer ? "Freelancer" : employee ? "Employee" : "Not linked"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {freelancer && (!employee || isFreelancer) ? (
        <FreelancerProfileForm key={freelancer.id} record={freelancer} />
      ) : employee ? (
        <EmployeeProfileForm key={employee.id} record={employee} />
      ) : (
        <EmptyState
          icon={UserCircle}
          title="No profile linked yet"
          description="Your account is not linked to an employee or freelancer record. Ask HR to create your record using this same email address."
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="border-border/60 bg-card/50"
      />
    </div>
  );
}

function EmployeeProfileForm({
  record,
}: {
  record: NonNullable<ReturnType<typeof useMyEmployee>["data"]>;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: record.full_name ?? "",
    mobile: record.mobile ?? "",
    address: record.address ?? "",
    emergency_contact: record.emergency_contact ?? "",
  });

  useEffect(() => {
    setForm({
      full_name: record.full_name ?? "",
      mobile: record.mobile ?? "",
      address: record.address ?? "",
      emergency_contact: record.emergency_contact ?? "",
    });
  }, [record]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("employees")
        .update({
          full_name: form.full_name.trim(),
          mobile: form.mobile.trim() || null,
          address: form.address.trim() || null,
          emergency_contact: form.emergency_contact.trim() || null,
        })
        .eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-employee"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update profile"),
  });

  return (
    <Card className="glass-card border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Employee Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={form.full_name}
            onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
          />
          <Field label="Employee code" value={record.employee_code ?? ""} disabled />
          <Field label="Designation" value={record.designation ?? ""} disabled />
          <Field label="Joining date" value={record.joining_date ?? ""} disabled />
          <Field
            label="Mobile"
            value={form.mobile}
            onChange={(v) => setForm((f) => ({ ...f, mobile: v }))}
          />
          <Field
            label="Emergency contact"
            value={form.emergency_contact}
            onChange={(v) => setForm((f) => ({ ...f, emergency_contact: v }))}
          />
          <Field
            label="Address"
            value={form.address}
            onChange={(v) => setForm((f) => ({ ...f, address: v }))}
          />
          <Field label="Salary" value={inr(record.salary)} disabled />
        </div>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.full_name.trim()}
          className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90"
        >
          {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}

function FreelancerProfileForm({
  record,
}: {
  record: NonNullable<ReturnType<typeof useMyFreelancer>["data"]>;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: record.full_name ?? "",
    mobile: record.mobile ?? "",
    portfolio_url: record.portfolio_url ?? "",
    skills: (record.skills ?? []).join(", "),
  });

  useEffect(() => {
    setForm({
      full_name: record.full_name ?? "",
      mobile: record.mobile ?? "",
      portfolio_url: record.portfolio_url ?? "",
      skills: (record.skills ?? []).join(", "),
    });
  }, [record]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("freelancers")
        .update({
          full_name: form.full_name.trim(),
          mobile: form.mobile.trim() || null,
          portfolio_url: form.portfolio_url.trim() || null,
          skills: form.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        })
        .eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-freelancer"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update profile"),
  });

  return (
    <Card className="glass-card border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Freelancer Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={form.full_name}
            onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
          />
          <Field label="Freelancer code" value={record.freelancer_code ?? ""} disabled />
          <Field
            label="Mobile"
            value={form.mobile}
            onChange={(v) => setForm((f) => ({ ...f, mobile: v }))}
          />
          <Field
            label="Portfolio URL"
            value={form.portfolio_url}
            onChange={(v) => setForm((f) => ({ ...f, portfolio_url: v }))}
          />
          <Field
            label="Skills (comma separated)"
            value={form.skills}
            onChange={(v) => setForm((f) => ({ ...f, skills: v }))}
          />
          <Field label="Hourly rate" value={inr(record.hourly_rate)} disabled />
          <Field
            label="Commission percentage"
            value={`${Number(record.commission_percentage ?? 0)}%`}
            disabled
          />
          <Field
            label="Experience (years)"
            value={String(record.experience_years ?? 0)}
            disabled
          />
        </div>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.full_name.trim()}
          className="bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90"
        >
          {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}
