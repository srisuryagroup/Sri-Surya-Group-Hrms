import { createFileRoute } from "@tanstack/react-router";
import { AuthCallback } from "@/components/auth-callback-view";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Verifying account — Sri Surya Group HRMS" },
      { name: "description", content: "Securely verifying your Sri Surya Group HRMS account." },
      { property: "og:title", content: "Verifying account — Sri Surya Group HRMS" },
      { property: "og:description", content: "Securely verifying your Sri Surya Group HRMS account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});
