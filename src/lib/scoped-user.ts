// Fonte única de verdade sobre "de qual usuário são os dados desta tela".
//
// Regras:
// - usuário autenticado  = quem fez login (pode ser o administrador Master);
// - usuário visualizado  = alvo do modo "Visitar usuário" (somente leitura).
//
// TODA query de dados pessoais deve:
//   1. usar `useScopedUser()` para obter `userId`;
//   2. incluir `userId` na `queryKey`;
//   3. filtrar explicitamente por `user_id` no Supabase (nunca confiar apenas no RLS,
//      pois o Master possui políticas de leitura ampliada e receberia linhas de outros usuários);
//   4. ficar desabilitada (`enabled: !!userId`) enquanto o usuário não for conhecido.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getViewAs } from "@/lib/view-as";

export type ScopedUser = {
  /** ID do usuário cujos dados devem ser exibidos (visitado ou autenticado). */
  userId: string | null;
  /** ID de quem está autenticado de fato. */
  authUserId: string | null;
  email: string | null;
  /** true quando um administrador está visitando a conta de outro usuário. */
  readOnly: boolean;
  isLoading: boolean;
};

export function useScopedUser(): ScopedUser {
  const viewAs = typeof window === "undefined" ? null : getViewAs();

  const q = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  return {
    userId: viewAs ? viewAs.id : (q.data?.id ?? null),
    authUserId: q.data?.id ?? null,
    email: viewAs ? viewAs.email : (q.data?.email ?? null),
    readOnly: viewAs !== null,
    isLoading: viewAs ? false : q.isLoading,
  };
}
