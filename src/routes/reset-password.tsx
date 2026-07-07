import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Reset password — Sri Surya Group HRMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPassword,
});

const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const passR = passwordSchema.safeParse(password);
    if (!passR.success) return toast.error(passR.error.issues[0].message);
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: passR.data });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in again.");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-md rounded-3xl p-8 sm:p-10">
        <Logo />
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Set a new password</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-new">New password</Label>
            <Input id="rp-new" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Confirm password</Label>
            <Input id="rp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
