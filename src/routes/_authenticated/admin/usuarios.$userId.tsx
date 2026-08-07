import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUserOverview } from "@/lib/admin.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/usuarios/$userId")({
  head: () => ({
    meta: [
      { title: "Dados do usuário — Painel NutriControl" },
      { name: "description", content: "Consulta somente leitura dos dados de um usuário." },
      { property: "og:title", content: "Dados do usuário — Painel NutriControl" },
      { property: "og:description", content: "Consulta somente leitura dos dados de um usuário." },
    ],
  }),
  component: AdminUserDetail,
});

const card = "rounded-xl border border-slate-200 bg-white shadow-sm p-4";
const th = "text-left font-medium px-3 py-2 text-slate-600";

function mealKcal(m: { meal_foods: Array<{ quantidade: number; foods: { energia_kcal: number } | null }> }) {
  return (m.meal_foods ?? []).reduce(
    (s, f) => s + ((f.foods?.energia_kcal ?? 0) * (f.quantidade ?? 0)) / 100,
    0,
  );
}

function AdminUserDetail() {
  const { userId } = Route.useParams();
  const fetchOverview = useServerFn(getUserOverview);
  const q = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => fetchOverview({ data: { userId } }),
  });

  const d = q.data;

  const waterByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of d?.water ?? []) map.set(w.data, (map.get(w.data) ?? 0) + w.quantidade_ml);
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [d?.water]);

  return (
    <div className="space-y-4">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-900">
        <ArrowLeft className="h-4 w-4" /> Voltar para usuários
      </Link>

      {q.isLoading && <div className="text-sm text-slate-600">Carregando dados do usuário...</div>}
      {q.error && <div className="text-sm text-red-400">{(q.error as Error).message}</div>}

      {d && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-xl font-bold">{d.profile?.nome ?? "Sem nome"}</h1>
              <div className="text-sm text-slate-600">{d.auth.email}</div>
            </div>
            <Badge className={d.auth.banned ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}>
              {d.auth.banned ? "sem acesso" : "ativo"}
            </Badge>
            <Badge variant="outline" className="gap-1 border-slate-300 text-slate-700">
              <Lock className="h-3 w-3" /> somente leitura
            </Badge>
          </div>

          <Tabs defaultValue="perfil">
            <TabsList className="bg-slate-200 flex-wrap h-auto">
              <TabsTrigger value="perfil">Perfil</TabsTrigger>
              <TabsTrigger value="alimentacao">Alimentação</TabsTrigger>
              <TabsTrigger value="treinos">Treinos</TabsTrigger>
              <TabsTrigger value="agua">Hidratação</TabsTrigger>
              <TabsTrigger value="evolucao">Evolução física</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="grid gap-3 md:grid-cols-2">
              <div className={card}>
                <div className="mb-2 font-semibold">Perfil</div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-600">Peso</dt><dd>{d.profile?.peso ?? "—"} kg</dd>
                  <dt className="text-slate-600">Peso meta</dt><dd>{d.profile?.peso_meta ?? "—"} kg</dd>
                  <dt className="text-slate-600">Altura</dt><dd>{d.profile?.altura ?? "—"} m</dd>
                  <dt className="text-slate-600">Idade</dt><dd>{d.profile?.idade ?? "—"}</dd>
                  <dt className="text-slate-600">Objetivo</dt><dd>{d.profile?.objetivo ?? "—"}</dd>
                  <dt className="text-slate-600">Cadastro</dt>
                  <dd>{d.auth.created_at ? new Date(d.auth.created_at).toLocaleDateString("pt-BR") : "—"}</dd>
                  <dt className="text-slate-600">Último acesso</dt>
                  <dd>{d.auth.last_sign_in_at ? new Date(d.auth.last_sign_in_at).toLocaleString("pt-BR") : "—"}</dd>
                </dl>
              </div>
              <div className={card}>
                <div className="mb-2 font-semibold">Metas nutricionais</div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-600">Calorias</dt><dd>{d.goals?.calorias ?? "—"} kcal</dd>
                  <dt className="text-slate-600">Proteínas</dt><dd>{d.goals?.proteinas ?? "—"} g</dd>
                  <dt className="text-slate-600">Carboidratos</dt><dd>{d.goals?.carboidratos ?? "—"} g</dd>
                  <dt className="text-slate-600">Gorduras</dt><dd>{d.goals?.gorduras ?? "—"} g</dd>
                  <dt className="text-slate-600">Fibras</dt><dd>{d.goals?.fibras ?? "—"} g</dd>
                  <dt className="text-slate-600">Meta de água</dt><dd>{d.waterGoal ?? "—"} ml</dd>
                </dl>
              </div>
            </TabsContent>

            <TabsContent value="alimentacao">
              <div className={card}>
                <div className="mb-2 font-semibold">Últimas refeições ({d.meals.length})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr><th className={th}>Data</th><th className={th}>Tipo</th><th className={th}>Itens</th><th className={th}>Calorias</th></tr></thead>
                    <tbody>
                      {d.meals.map((m) => (
                        <tr key={m.id} className="border-t border-slate-200 align-top">
                          <td className="px-3 py-2 text-slate-600">{new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="px-3 py-2">{String(m.tipo).replace(/_/g, " ")}</td>
                          <td className="px-3 py-2">
                            {(m.meal_foods ?? []).map((f, i) => (
                              <div key={i} className="text-slate-700">
                                {f.foods?.nome ?? "—"} · {f.quantidade}{f.foods?.unidade_base ?? "g"}
                              </div>
                            ))}
                          </td>
                          <td className="px-3 py-2">{mealKcal(m).toFixed(0)} kcal</td>
                        </tr>
                      ))}
                      {d.meals.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Nenhuma refeição registrada.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="treinos">
              <div className={card}>
                <div className="mb-2 font-semibold">Histórico de treinos ({d.workouts.length})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr><th className={th}>Data</th><th className={th}>Duração</th><th className={th}>Exercícios</th><th className={th}>Status</th></tr></thead>
                    <tbody>
                      {d.workouts.map((w) => (
                        <tr key={w.id} className="border-t border-slate-200 align-top">
                          <td className="px-3 py-2 text-slate-600">{new Date(w.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="px-3 py-2">{w.duracao_min ? `${w.duracao_min} min` : "—"}</td>
                          <td className="px-3 py-2">
                            {(w.workout_exercises ?? []).map((e, i) => (
                              <div key={i} className="text-slate-700">
                                {e.exercises?.nome ?? "—"} · {e.series ?? "—"}x{e.repeticoes ?? "—"}
                                {e.peso ? ` · ${e.peso}kg` : ""}
                              </div>
                            ))}
                          </td>
                          <td className="px-3 py-2">{w.finalizado_em ? "finalizado" : "em aberto"}</td>
                        </tr>
                      ))}
                      {d.workouts.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Nenhum treino registrado.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="agua">
              <div className={card}>
                <div className="mb-2 font-semibold">Consumo de água por dia</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr><th className={th}>Data</th><th className={th}>Total</th><th className={th}>% da meta</th></tr></thead>
                    <tbody>
                      {waterByDay.map(([dia, ml]) => (
                        <tr key={dia} className="border-t border-slate-200">
                          <td className="px-3 py-2 text-slate-600">{new Date(dia + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="px-3 py-2">{ml} ml</td>
                          <td className="px-3 py-2">{d.waterGoal ? `${((ml / d.waterGoal) * 100).toFixed(0)}%` : "—"}</td>
                        </tr>
                      ))}
                      {waterByDay.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">Nenhum registro de água.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evolucao">
              <div className={card}>
                <div className="mb-3 font-semibold">Fotos de evolução ({d.photos.length})</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {d.photos.map((p) => (
                    <figure key={p.id} className="overflow-hidden rounded-lg border border-slate-200">
                      {p.url ? (
                        <img
                          src={p.url}
                          alt={`Foto de evolução (${p.categoria}) de ${new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")}`}
                          className="h-40 w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-40 place-items-center text-xs text-slate-500">sem imagem</div>
                      )}
                      <figcaption className="p-2 text-xs text-slate-600">
                        {new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")} · {p.categoria}
                        {p.peso_kg ? ` · ${p.peso_kg}kg` : ""}
                      </figcaption>
                    </figure>
                  ))}
                  {d.photos.length === 0 && <div className="text-sm text-slate-500">Nenhuma foto registrada.</div>}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
