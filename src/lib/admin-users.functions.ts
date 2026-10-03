import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Super Admin only: create an HR Manager account. */
export const createHrManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(254),
        password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleErr || !isAdmin) throw new Error("Only a Super Admin can create HR Manager accounts.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, account_type: "employee" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create account");

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "hr_manager" });
    if (insErr) throw new Error(insErr.message);
    return { id: created.user.id, email: data.email };
  });
