import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth-callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirming account — Sri Surya Group HRMS" },
      {
        name: "description",
        content: "Securely confirming your Sri Surya Group HRMS account.",
      },
      { property: "og:title", content: "Confirming account — Sri Surya Group HRMS" },
      {
        property: "og:description",
        content: "Securely confirming your Sri Surya Group HRMS account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function completeVerification() {
      const url = new URL(window.location.href);
      const callbackError =
        url.searchParams.get("error_description") ??
        new URLSearchParams(url.hash.slice(1)).get("error_description");

      if (callbackError) {
        setError(callbackError);
        return;
      }

      const code = url.searchParams.get("code");
      let { data, error: sessionError } = await supabase.auth.getSession();

      if (!data.session && code) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        data = exchanged.data;
        sessionError = exchanged.error;
      }

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (!data.session) {
        const session = await new Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>>(
          (resolve) => {
            const timeout = window.setTimeout(
              () => resolve({ data: { session: null }, error: null }),
              3000,
            );
            const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
              if (!nextSession) return;
              window.clearTimeout(timeout);
              listener.subscription.unsubscribe();
              resolve({ data: { session: nextSession }, error: null });
            });
          },
        );
        data = session.data;
      }

      if (!data.session) {
        setError("The verification link is invalid or has expired. Please sign in or request a new link.");
        return;
      }

      await navigate({ to: "/dashboard", replace: true });
    }

    void completeVerification();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <div className="flex justify-center">
          <Logo />
        </div>
        {error ? (
          <div className="mt-8 space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">Verification failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => navigate({ to: "/auth", replace: true })} className="w-full">
              Return to sign in
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <h1 className="text-xl font-semibold">Confirming your account</h1>
            <p className="text-sm text-muted-foreground">You’ll be redirected to your dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}