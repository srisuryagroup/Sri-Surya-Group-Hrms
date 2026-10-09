import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
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
    meta: [
      { title: "Reset password — Sri Surya Group HRMS" },
      { name: "description", content: "Securely reset your Sri Surya Group HRMS password." },
      { property: "og:title", content: "Reset password — Sri Surya Group HRMS" },
      { property: "og:description", content: "Securely reset your Sri Surya Group HRMS password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Establish the recovery session from the emailed link (PKCE code or token hash).
  useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (s && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) { done = true; setReady(true); }
    });
    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      const errDesc = url.searchParams.get("error_description") ?? hash.get("error_description");
      if (errDesc) { setLinkError(errDesc); return; }
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setLinkError(error.message); return; }
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (error) { setLinkError(error.message); return; }
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) { done = true; setReady(true); return; }
      setTimeout(() => { if (!done) setLinkError("This reset link is invalid or has expired. Please request a new one."); }, 3000);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

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
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-md rounded-3xl p-8 sm:p-10">
        <Logo />
        {linkError ? (
          <div className="mt-8 space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">Reset link not valid</h2>
            <p className="text-sm text-muted-foreground">{linkError}</p>
            <Button onClick={() => navigate({ to: "/auth", search: { mode: "forgot" } })} className="w-full">Request a new link</Button>
          </div>
        ) : !ready ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Verifying reset link…</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
