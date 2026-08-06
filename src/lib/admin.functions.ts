import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Whether the current caller is a Master admin (validated in the database). */
export const amIMaster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master",
    });
    return { master: data === true };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertMaster, supabaseAdmin } = await import("@/lib/admin.server");
    await assertMaster(context as never);

    const users: Array<{
      id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      banned: boolean;
    }> = [];
    let page = 1;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        users.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          banned: Boolean((u as { banned_until?: string | null }).banned_until),
        });
      }
      if (data.users.length < 200) break;
      page += 1;
    }

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    return users.map((u) => {
      const p = (profiles ?? []).find((x) => x.id === u.id) ?? null;
      return {
        ...u,
        nome: p?.nome ?? null,
        peso: p?.peso ?? null,
        altura: p?.altura ?? null,
        idade: p?.idade ?? null,
        objetivo: p?.objetivo ?? null,
        ativo: p?.ativo ?? true,
        bloqueado_em: p?.bloqueado_em ?? null,
        desativado_em: p?.desativado_em ?? null,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as string),
      };
    });
  });

export const getUserOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertMaster, supabaseAdmin } = await import("@/lib/admin.server");
    await assertMaster(context as never);
    const uid = data.userId;

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid);
    const [profile, goals, meals, workouts, water, photos, waterGoal] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("nutrition_goals").select("*").eq("user_id", uid).maybeSingle(),
      supabaseAdmin
        .from("meals")
        .select("id, data, horario, tipo, observacao, meal_foods(quantidade, foods(nome, energia_kcal, proteina, carboidrato, gordura, unidade_base))")
        .eq("user_id", uid)
        .order("data", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("workouts")
        .select("id, data, horario, duracao_min, observacoes, finalizado_em, workout_exercises(peso, series, repeticoes, concluido, exercises(nome, grupo_muscular))")
        .eq("user_id", uid)
        .order("data", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("water_logs")
        .select("id, data, quantidade_ml")
        .eq("user_id", uid)
        .order("data", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("progress_photos")
        .select("id, data, categoria, storage_path, peso_kg, observacoes")
        .eq("user_id", uid)
        .order("data", { ascending: false })
        .limit(60),
      supabaseAdmin.from("water_goals").select("meta_ml").eq("user_id", uid).maybeSingle(),
    ]);

    const photoList = photos.data ?? [];
    const signed = await Promise.all(
      photoList.map(async (p) => {
        const { data: s } = await supabaseAdmin.storage
          .from("progress-photos")
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, url: s?.signedUrl ?? null };
      }),
    );

    return {
      auth: {
        id: uid,
        email: authUser?.user?.email ?? null,
        created_at: authUser?.user?.created_at ?? null,
        last_sign_in_at: authUser?.user?.last_sign_in_at ?? null,
        banned: Boolean((authUser?.user as { banned_until?: string | null } | undefined)?.banned_until),
      },
      profile: profile.data,
      goals: goals.data,
      waterGoal: waterGoal.data?.meta_ml ?? null,
      meals: meals.data ?? [],
      workouts: workouts.data ?? [],
      water: water.data ?? [],
      photos: signed,
    };
  });

export const setUserAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["ativar", "desativar", "bloquear"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertMaster, logAdminAction, supabaseAdmin } = await import("@/lib/admin.server");
    const { adminId, adminEmail } = await assertMaster(context as never);

    if (data.userId === context.userId) {
      throw new Error("Você não pode alterar o status da própria conta de administrador");
    }

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const targetEmail = target?.user?.email ?? null;

    const ban = data.action === "ativar" ? "none" : "876000h";
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: ban,
    });
    if (authErr) throw new Error(authErr.message);

    const now = new Date().toISOString();
    const patch =
      data.action === "ativar"
        ? { ativo: true, desativado_em: null, bloqueado_em: null }
        : data.action === "desativar"
          ? { ativo: false, desativado_em: now, bloqueado_em: null }
          : { ativo: false, desativado_em: null, bloqueado_em: now };

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update(patch as never)
      .eq("id", data.userId);
    if (profErr) throw new Error(profErr.message);

    await logAdminAction({
      adminId,
      adminEmail,
      targetUserId: data.userId,
      targetEmail,
      acao: data.action,
      detalhes: { ban_duration: ban },
    });

    return { ok: true };
  });

export const listAdminLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertMaster, supabaseAdmin } = await import("@/lib/admin.server");
    await assertMaster(context as never);
    const { data, error } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
