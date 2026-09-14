import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScopedUser } from "@/lib/scoped-user";
import { scopedAuthUser } from "@/lib/view-as";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type WorkoutRow = {
  id: string;
  data: string;
  observacoes: string | null;
  workout_exercises?: Array<{
    id: string;
    peso: number | null;
    series: number | null;
    repeticoes: number | null;
    exercise_id: string;
    exercises: { nome: string; grupo_muscular: string | null } | null;
  }> | null;
};

type Point = {
  data: string;
  label: string;
  peso: number;
  reps: number;
  series: number;
  modelo: string;
  exercicio: string;
  deltaPeso: number | null;
  deltaReps: number | null;
};

function fmt(d: string) {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y?.slice(2)}`;
}

function seriesFor(workouts: WorkoutRow[], exerciseId: string): Point[] {
  const raw: Omit<Point, "deltaPeso" | "deltaReps">[] = [];
  for (const w of [...workouts].sort((a, b) => a.data.localeCompare(b.data))) {
    for (const we of w.workout_exercises ?? []) {
      if (we.exercise_id !== exerciseId) continue;
      raw.push({
        data: w.data,
        label: fmt(w.data),
        peso: Number(we.peso) || 0,
        reps: Number(we.repeticoes) || 0,
        series: Number(we.series) || 0,
        modelo: w.observacoes?.trim() || "Treino",
        exercicio: we.exercises?.nome ?? "Exercício",
      });
    }
  }
  return raw.map((p, i) => ({
    ...p,
    deltaPeso: i > 0 ? Number((p.peso - raw[i - 1].peso).toFixed(1)) : null,
    deltaReps: i > 0 ? p.reps - raw[i - 1].reps : null,
  }));
}

function ProgressTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const delta = (v: number | null, unit: string) => {
    if (v === null) return <span className="text-muted-foreground">primeiro registro</span>;
    const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
    const cls = v > 0 ? "text-emerald-500" : v < 0 ? "text-destructive" : "text-muted-foreground";
    return (
      <span className={`inline-flex items-center gap-1 font-semibold ${cls}`}>
        <Icon className="h-3 w-3" />
        {v > 0 ? "+" : ""}
        {v}
        {unit}
      </span>
    );
  };
  return (
    <div className="rounded-lg border bg-popover/95 backdrop-blur px-3 py-2 text-xs shadow-xl space-y-1">
      <div className="font-bold">{new Date(`${p.data}T12:00:00`).toLocaleDateString("pt-BR")}</div>
      <div className="text-muted-foreground">Modelo: <span className="text-foreground">{p.modelo}</span></div>
      <div className="text-muted-foreground">Exercício: <span className="text-foreground">{p.exercicio}</span></div>
      <div>Carga: <span className="font-semibold">{p.peso} kg</span> · {delta(p.deltaPeso, " kg")}</div>
      <div>Repetições: <span className="font-semibold">{p.reps}</span> · {delta(p.deltaReps, "")}</div>
      <div>Séries: <span className="font-semibold">{p.series}</span></div>
    </div>
  );
}

function ExerciseChart({ nome, points }: { nome: string; points: Point[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  const varPeso = points.length > 1 ? Number((last.peso - first.peso).toFixed(1)) : 0;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="font-semibold text-sm">{nome}</div>
        <div className="text-xs text-muted-foreground">
          {points.length} registro(s) ·{" "}
          <span className={varPeso >= 0 ? "text-emerald-500 font-semibold" : "text-destructive font-semibold"}>
            {varPeso > 0 ? "+" : ""}
            {varPeso} kg
          </span>{" "}
          no período
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${nome.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" fontSize={11} tickMargin={6} stroke="var(--muted-foreground)" />
            <YAxis
              yAxisId="peso"
              fontSize={11}
              unit="kg"
              stroke="var(--muted-foreground)"
              width={52}
            />
            <YAxis
              yAxisId="reps"
              orientation="right"
              fontSize={11}
              stroke="var(--muted-foreground)"
              width={34}
            />
            <Tooltip content={<ProgressTooltip />} />
            <Area
              yAxisId="peso"
              type="monotone"
              dataKey="peso"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill={`url(#grad-${nome.replace(/\W/g, "")})`}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              animationDuration={800}
              name="Carga (kg)"
            />
            <Line
              yAxisId="reps"
              type="monotone"
              dataKey="reps"
              stroke="var(--chart-2, #f59e0b)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3 }}
              animationDuration={800}
              name="Repetições"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-primary" /> Carga (kg)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-4 rounded" style={{ background: "var(--chart-2, #f59e0b)" }} /> Repetições
        </span>
      </div>
    </div>
  );
}

export function LoadProgression({ workouts }: { workouts: WorkoutRow[] }) {
  const [exerciseId, setExerciseId] = useState("");
  const [templateId, setTemplateId] = useState("");

  // Apenas exercícios que o usuário já executou
  const performed = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workouts) {
      for (const we of w.workout_exercises ?? []) {
        if (we.peso == null && we.repeticoes == null) continue;
        map.set(we.exercise_id, we.exercises?.nome ?? "Exercício");
      }
    }
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [workouts]);

  const { userId } = useScopedUser();
  const templatesQ = useQuery({
    queryKey: ["templates-progression", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_templates")
        .select("id, nome, template_exercises(exercise_id, ordem, exercises(nome))")
        .eq("user_id", userId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedTemplate = (templatesQ.data ?? []).find((t) => t.id === templateId);

  const templateCharts = useMemo(() => {
    if (!selectedTemplate) return [];
    const exs = [...(selectedTemplate.template_exercises ?? [])].sort(
      (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
    );
    return exs
      .map((te) => ({
        nome: te.exercises?.nome ?? "Exercício",
        points: seriesFor(workouts, te.exercise_id),
      }))
      .filter((c) => c.points.length > 0);
  }, [selectedTemplate, workouts]);

  const exPoints = useMemo(
    () => (exerciseId ? seriesFor(workouts, exerciseId) : []),
    [exerciseId, workouts],
  );
  const exNome = performed.find((e) => e.id === exerciseId)?.nome ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Progressão de Carga</CardTitle>
        <p className="text-xs text-muted-foreground">
          Evolução de carga e repetições ao longo do tempo. Toque em um ponto do gráfico para ver os
          detalhes do treino.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="exercicio">
          <TabsList>
            <TabsTrigger value="exercicio">Por exercício</TabsTrigger>
            <TabsTrigger value="modelo">Por modelo de treino</TabsTrigger>
          </TabsList>

          <TabsContent value="exercicio" className="space-y-3 pt-3">
            <div className="max-w-xs">
              <Label className="text-xs">Exercício executado</Label>
              <Select value={exerciseId} onValueChange={setExerciseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um exercício" />
                </SelectTrigger>
                <SelectContent>
                  {performed.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                  {performed.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhum exercício executado no período
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            {exPoints.length > 0 ? (
              <ExerciseChart nome={exNome} points={exPoints} />
            ) : (
              <div className="grid place-items-center h-40 text-sm text-muted-foreground">
                Selecione um exercício para ver a progressão
              </div>
            )}
          </TabsContent>

          <TabsContent value="modelo" className="space-y-3 pt-3">
            <div className="max-w-xs">
              <Label className="text-xs">Modelo de treino</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {(templatesQ.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {templateCharts.length > 0 ? (
              <div className="grid gap-3">
                {templateCharts.map((c) => (
                  <ExerciseChart key={c.nome} nome={c.nome} points={c.points} />
                ))}
              </div>
            ) : (
              <div className="grid place-items-center h-40 text-sm text-muted-foreground">
                {templateId
                  ? "Nenhum exercício deste modelo foi executado no período selecionado"
                  : "Selecione um modelo para comparar a evolução de todos os seus exercícios"}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
