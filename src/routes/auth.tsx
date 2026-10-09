import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { SITE_URL, AUTH_CALLBACK_URL } from "@/lib/site";
import { Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: "signin" | "signup" | "forgot" } => {
    const mode = search.mode;
    if (mode === "signup" || mode === "forgot" || mode === "signin") {
      return { mode };
    }
    return {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Sri Surya Group HRMS" },
      {
        name: "description",
        content: "Sign in or create your Sri Surya Group HRMS account.",
      },
      { property: "og:title", content: "Sign in — Sri Surya Group HRMS" },
      {
        property: "og:description",
        content: "Sign in or create your Sri Surya Group HRMS account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Please enter a valid email").max(254);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);
const nameSchema = z.string().trim().min(2, "Name is required").max(80);

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode ?? "signin");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "var(--gradient-aurora)" }} />
      <div className="relative grid w-full max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Left brand panel */}
        <div className="glass-card hidden flex-col justify-between rounded-3xl p-10 lg:flex">
          <Logo size="lg" />
          <div className="space-y-6">
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight">
              Manage your{" "}
              <span className="text-gradient-surya">entire workforce</span>
              <br />
              in one platform.
            </h1>
            <p className="max-w-md text-base text-muted-foreground">
              Employees, freelancers, projects, tasks, commissions & business operations —
              beautifully organized, securely managed.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 Sri Surya Group. All Rights Reserved.</p>
        </div>

        {/* Right auth panel */}
        <div className="glass-card rounded-3xl p-8 sm:p-10">
          <div className="lg:hidden mb-6"><Logo /></div>
          {mode === "forgot" ? (
            <ForgotForm onBack={() => setMode("signin")} />
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 bg-secondary/60">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-6">
                <SignInForm onForgot={() => setMode("forgot")} />
              </TabsContent>
              <TabsContent value="signup" className="mt-6">
                <SignUpForm onSuccess={() => setMode("signin")} />
              </TabsContent>
            </Tabs>
          )}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing, you agree to Sri Surya Group's Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const emailR = emailSchema.safeParse(email);
    const passR = passwordSchema.safeParse(password);
    if (!emailR.success) return toast.error(emailR.error.issues[0].message);
    if (!passR.success) return toast.error(passR.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailR.data, password: passR.data });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Invalid email or password" : error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Access your Sri Surya Group workspace.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@srisuryagroup.com" required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          <button type="button" onClick={onForgot} className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </button>
        </div>
        <Input id="signin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"employee" | "freelancer">("employee");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nameR = nameSchema.safeParse(name);
    const emailR = emailSchema.safeParse(email);
    const passR = passwordSchema.safeParse(password);
    if (!nameR.success) return toast.error(nameR.error.issues[0].message);
    if (!emailR.success) return toast.error(emailR.error.issues[0].message);
    if (!passR.success) return toast.error(passR.error.issues[0].message);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: emailR.data,
      password: passR.data,
      options: {
        emailRedirectTo: AUTH_CALLBACK_URL,
        data: { full_name: nameR.data, account_type: accountType },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created successfully.");
      window.location.assign("/dashboard");
      return;
    }
    toast.success("Account created! Check your email to confirm your account.");
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Create your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The first account created becomes the Super Admin.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Account type</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
          {(["employee", "freelancer"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              role="radio"
              aria-checked={accountType === t}
              variant={accountType === t ? "default" : "outline"}
              onClick={() => setAccountType(t)}
              className={accountType === t ? "bg-gradient-surya text-primary-foreground" : ""}
            >
              {t === "employee" ? "Employee" : "Freelancer"}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full name</Label>
        <Input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Work email</Label>
        <Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@srisuryagroup.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" required />
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create account
      </Button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const emailR = emailSchema.safeParse(email);
    if (!emailR.success) return toast.error(emailR.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailR.data, {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset link sent — check your inbox.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </button>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reset your password</h2>
        <p className="mt-1 text-sm text-muted-foreground">We'll email you a secure reset link.</p>
      </div>
      {sent ? (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-foreground">
          If an account exists for <span className="font-medium">{email}</span>, a reset link has been sent.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-surya text-primary-foreground surya-glow hover:opacity-90">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
        </>
      )}
    </form>
  );
}
