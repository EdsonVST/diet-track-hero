// Server-only helpers for the administrative (Master) panel.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AuthedContext = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
  userId: string;
  claims: Record<string, unknown>;
};

/** Throws unless the caller has the `master` role (validated in the database). */
export async function assertMaster(context: AuthedContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "master",
  });
  if (error || data !== true) {
    throw new Error("Forbidden: acesso restrito a administradores");
  }
  return { adminId: context.userId, adminEmail: (context.claims["email"] as string) ?? null };
}

export async function logAdminAction(params: {
  adminId: string;
  adminEmail: string | null;
  targetUserId: string;
  targetEmail: string | null;
  acao: string;
  detalhes?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("admin_audit_logs").insert({
    admin_id: params.adminId,
    admin_email: params.adminEmail,
    target_user_id: params.targetUserId,
    target_email: params.targetEmail,
    acao: params.acao,
    detalhes: params.detalhes ?? {},
  } as never);
}

export { supabaseAdmin };
