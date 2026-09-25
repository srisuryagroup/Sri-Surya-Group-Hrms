import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sri Surya Group HRMS" },
      { name: "description", content: "Sign in to Sri Surya Group HRMS for employee and freelancer management." },
      { property: "og:title", content: "Sri Surya Group HRMS" },
      { property: "og:description", content: "Sign in to Sri Surya Group HRMS for employee and freelancer management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
