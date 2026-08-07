// "Visitar usuário": modo administrativo de leitura da conta de outro usuário.
// A leitura é permitida por políticas RLS específicas para o papel `master`;
// nenhuma escrita é possível (RLS restringe escrita ao próprio usuário) e a UI
// desabilita todos os controles de edição.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ViewAsTarget = { id: string; nome: string | null; email: string | null };

const KEY = "nutricontrol.viewAs";

export function getViewAs(): ViewAsTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewAsTarget;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Substitui `supabase.auth.getUser()` nas telas do app: devolve o usuário
 * visitado quando o administrador está em modo somente leitura.
 */
export async function scopedAuthUser(): Promise<{
  data: { user: { id: string; email: string | null } | null };
}> {
  const target = getViewAs();
  if (target) return { data: { user: { id: target.id, email: target.email } } };
  const { data } = await supabase.auth.getUser();
  return { data: { user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null } };
}

export function startViewAs(target: ViewAsTarget) {
  window.localStorage.setItem(KEY, JSON.stringify(target));
  // Recarrega a aplicação para descartar qualquer cache do administrador.
  window.location.href = "/dashboard";
}

export function stopViewAs() {
  window.localStorage.removeItem(KEY);
  window.location.href = "/admin";
}

export function useViewAs() {
  const [target, setTarget] = useState<ViewAsTarget | null>(null);
  useEffect(() => setTarget(getViewAs()), []);
  return { viewAs: target, readOnly: target !== null };
}
