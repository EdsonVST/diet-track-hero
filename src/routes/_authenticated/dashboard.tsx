import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { computeNutrients, emptyTotals, sumTotals, MEAL_LABELS } from "@/lib/nutrition";
import { Flame, Beef, Wheat, Droplet, Camera, Dumbbell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DashboardPage() {
  const date = today();

  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nutrition_goals").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const todayQ = useQuery({
    queryKey: ["meals-today", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meals")
        .select("id,tipo,horario,meal_foods(id,quantidade,foods(nome,unidade_base,energia_kcal,proteina,carboidrato,gordura,fibra,sodio))")
        .eq("data", date)
        .order("horario", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const meals = todayQ.data ?? [];
  let totals = emptyTotals();
  const perMeal: Record<string, ReturnType<typeof emptyTotals>> = {};
  for (const m of meals) {
    let mt = emptyTotals();
    for (const mf of m.meal_foods ?? []) {
      if (!mf.foods) continue;
      mt = sumTotals(mt, computeNutrients(mf.foods as any, Number(mf.quantidade)));
    }
    perMeal[m.tipo] = sumTotals(perMeal[m.tipo] ?? emptyTotals(), mt);
    totals = sumTotals(totals, mt);
  }

  const goals = goalsQ.data ?? { calorias: 2000, proteinas: 120, carboidratos: 250, gorduras: 65, fibras: 25 };

  const cards = [
    { label: "Calorias", value: totals.calorias, goal: Number(goals.calorias), unit: "kcal", icon: Flame, color: "bg-primary/10 text-primary" },
    { label: "Proteínas", value: totals.proteina, goal: Number(goals.proteinas), unit: "g", icon: Beef, color: "bg-[color:var(--color-protein)]/10 text-[color:var(--color-protein)]" },
    { label: "Carboidratos", value: totals.carboidrato, goal: Number(goals.carboidratos), unit: "g", icon: Wheat, color: "bg-[color:var(--color-carbs)]/15 text-[color:var(--color-carbs)]" },
    { label: "Gorduras", value: totals.gordura, goal: Number(goals.gorduras), unit: "g", icon: Droplet, color: "bg-[color:var(--color-fat)]/10 text-[color:var(--color-fat)]" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão do dia — {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
        </div>
        <Button asChild>
          <Link to="/alimentacao">Registrar refeição</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const pct = c.goal > 0 ? Math.min(100, (c.value / c.goal) * 100) : 0;
          const remaining = Math.max(0, c.goal - c.value);
          return (
            <Card key={c.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 grid place-items-center rounded-xl ${c.color}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                    <div className="text-xl font-bold">
                      {c.value} <span className="text-sm text-muted-foreground font-medium">/ {c.goal} {c.unit}</span>
                    </div>
                  </div>
                </div>
                <Progress value={pct} className="mt-3 h-2" />
                <div className="text-xs text-muted-foreground mt-2">
                  Restam <span className="font-medium text-foreground">{remaining.toFixed(0)} {c.unit}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FitnessCards />

      <Card>

        <CardHeader>
          <CardTitle>Refeições de hoje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {["cafe_da_manha", "almoco", "lanche", "jantar"].map((tipo) => {
            const t = perMeal[tipo] ?? emptyTotals();
            return (
              <div key={tipo} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{MEAL_LABELS[tipo]}</div>
                  <div className="text-xs text-muted-foreground">
                    P {t.proteina}g · C {t.carboidrato}g · G {t.gordura}g
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{t.calorias} <span className="text-xs text-muted-foreground">kcal</span></div>
                </div>
              </div>
            );
          })}
          {meals.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhuma refeição registrada hoje. <Link to="/alimentacao" className="text-primary font-medium">Adicionar agora →</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function FitnessCards() {
  const today = todayISO();
  const dow = new Date().getDay();

  const waterGoal = useQuery({ queryKey: ["water_goal"], queryFn: async () => (await supabase.from("water_goals").select("*").maybeSingle()).data });
  const waterToday = useQuery({
    queryKey: ["water_today", today],
    queryFn: async () => (await supabase.from("water_logs").select("quantidade_ml").eq("data", today)).data ?? [],
  });
  const lastPhoto = useQuery({
    queryKey: ["last_photo"],
    queryFn: async () => (await supabase.from("progress_photos").select("data").order("data", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const todayWorkout = useQuery({
    queryKey: ["today-workout-card", dow],
    queryFn: async () => {
      const { data: plan } = await supabase.from("weekly_plans").select("id").eq("ativo", true).maybeSingle();
      if (!plan) return null;
      const { data: day } = await supabase.from("weekly_plan_days").select("*,workout_templates(nome)").eq("plan_id", plan.id).eq("dia_semana", dow).maybeSingle();
      return day;
    },
  });

  const meta = waterGoal.data?.meta_ml ?? 3000;
  const consumido = (waterToday.data ?? []).reduce((s, l) => s + l.quantidade_ml, 0);
  const pct = Math.min(100, (consumido / meta) * 100);

  const daysSincePhoto = lastPhoto.data?.data
    ? Math.floor((Date.now() - new Date(lastPhoto.data.data).getTime()) / 86400000)
    : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card><CardContent className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-sky-500/10 text-sky-500"><Droplet className="h-5 w-5" /></div>
          <div><div className="text-xs text-muted-foreground">Hidratação hoje</div>
          <div className="text-xl font-bold">{(consumido / 1000).toFixed(2)}L <span className="text-sm text-muted-foreground">/ {(meta / 1000).toFixed(1)}L</span></div></div>
        </div>
        <Progress value={pct} className="h-2" />
        <Button asChild variant="link" size="sm" className="px-0 mt-1"><Link to="/hidratacao">Registrar</Link></Button>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-primary/10 text-primary"><Dumbbell className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Treino de hoje</div>
            <div className="font-bold truncate">{todayWorkout.data?.workout_templates?.nome ?? todayWorkout.data?.rotulo ?? "Descanso"}</div>
          </div>
        </div>
        <Button asChild variant="link" size="sm" className="px-0 mt-1"><Link to="/treino-hoje">Abrir treino</Link></Button>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-accent/30 text-accent-foreground"><Camera className="h-5 w-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">Última foto</div>
            <div className="font-bold">{lastPhoto.data ? `${daysSincePhoto} ${daysSincePhoto === 1 ? "dia" : "dias"} atrás` : "Sem fotos"}</div>
          </div>
        </div>
        <Button asChild variant="link" size="sm" className="px-0 mt-1"><Link to="/evolucao-fisica">Ver evolução</Link></Button>
      </CardContent></Card>
    </div>
  );
}

