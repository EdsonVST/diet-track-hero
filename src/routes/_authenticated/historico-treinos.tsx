import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/historico-treinos")({
  component: HistoricoPage,
});

function HistoricoPage() {
  const [exerciseId, setExerciseId] = useState<string>("");

  const exercisesQ = useQuery({
    queryKey: ["exercises-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("id,nome,grupo_muscular").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const workoutsQ = useQuery({
    queryKey: ["all-workouts"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("workouts")
        .select("id, data, duracao_min, workout_exercises(id, peso, series, repeticoes, exercise_id, exercises(nome, grupo_muscular))")
        .eq("user_id", u.user.id)
        .order("data", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const workouts = workoutsQ.data ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthW = workouts.filter((w) => new Date(w.data) >= monthStart);
    const exCount = new Map<string, { nome: string; vezes: number }>();
    let totalDur = 0, durCount = 0;
    for (const w of workouts) {
      if (w.duracao_min) { totalDur += w.duracao_min; durCount++; }
      for (const we of (w.workout_exercises ?? []) as any[]) {
        const key = we.exercises?.nome ?? "?";
        const p = exCount.get(key) ?? { nome: key, vezes: 0 };
        exCount.set(key, { ...p, vezes: p.vezes + 1 });
      }
    }
    const topEx = Array.from(exCount.values()).sort((a, b) => b.vezes - a.vezes).slice(0, 5);
    // weekly frequency last 8 weeks
    const weekMap = new Map<string, number>();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i * 7);
      const key = `S-${i}`;
      weekMap.set(key, 0);
    }
    const freqData: { semana: string; treinos: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now); end.setDate(end.getDate() - i * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      const count = workouts.filter((w) => { const d = new Date(w.data); return d >= start && d <= end; }).length;
      freqData.push({ semana: `${start.getDate()}/${start.getMonth()+1}`, treinos: count });
    }
    // volume por grupo
    const grupoMap = new Map<string, number>();
    for (const w of workouts) {
      for (const we of (w.workout_exercises ?? []) as any[]) {
        const g = we.exercises?.grupo_muscular ?? "Outro";
        const vol = (Number(we.peso) || 0) * (Number(we.series) || 0) * (Number(we.repeticoes) || 0);
        grupoMap.set(g, (grupoMap.get(g) ?? 0) + vol);
      }
    }
    const grupoData = Array.from(grupoMap.entries()).map(([grupo, volume]) => ({ grupo, volume: Math.round(volume) }));
    return {
      mes: monthW.length,
      total: workouts.length,
      tempoMedio: durCount > 0 ? Math.round(totalDur / durCount) : 0,
      topEx, freqData, grupoData,
    };
  }, [workouts]);

  const evoData = useMemo(() => {
    if (!exerciseId) return [];
    const points: { data: string; peso: number }[] = [];
    for (const w of [...workouts].reverse()) {
      for (const we of (w.workout_exercises ?? []) as any[]) {
        if (we.exercise_id === exerciseId && we.peso != null) {
          points.push({ data: w.data, peso: Number(we.peso) });
        }
      }
    }
    return points;
  }, [exerciseId, workouts]);

  const evoPct = useMemo(() => {
    if (evoData.length < 2) return 0;
    const first = evoData[0].peso, last = evoData[evoData.length - 1].peso;
    if (!first) return 0;
    return Math.round(((last - first) / first) * 100);
  }, [evoData]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Histórico de Treinos</h1>
        <p className="text-sm text-muted-foreground">Evolução e estatísticas do seu treino</p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { l: "Treinos no mês", v: stats.mes },
          { l: "Total de treinos", v: stats.total },
          { l: "Tempo médio", v: `${stats.tempoMedio} min` },
          { l: "Exercícios distintos", v: stats.topEx.length },
        ].map((s) => (
          <Card key={s.l}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{s.l}</div>
            <div className="text-2xl font-bold mt-1">{s.v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução de carga por exercício</CardTitle>
          <Select value={exerciseId} onValueChange={setExerciseId}>
            <SelectTrigger className="max-w-xs"><SelectValue placeholder="Escolha um exercício" /></SelectTrigger>
            <SelectContent>
              {(exercisesQ.data ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="h-64">
          {evoData.length > 0 ? (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                Aumento percentual no período: <span className={`font-bold ${evoPct >= 0 ? "text-primary" : "text-destructive"}`}>{evoPct > 0 ? "+" : ""}{evoPct}%</span>
              </div>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={evoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" fontSize={11} />
                  <YAxis fontSize={11} unit="kg" />
                  <Tooltip />
                  <Line type="monotone" dataKey="peso" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="grid place-items-center h-full text-sm text-muted-foreground">Escolha um exercício para ver a evolução</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Frequência semanal</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer>
              <BarChart data={stats.freqData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semana" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="treinos" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Volume por grupo muscular</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer>
              <BarChart data={stats.grupoData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="grupo" fontSize={11} width={90} />
                <Tooltip />
                <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Exercícios mais executados</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {stats.topEx.map((e, i) => (
            <div key={e.nome} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="font-medium">{i+1}. {e.nome}</div>
              <div className="text-sm text-muted-foreground">{e.vezes}x</div>
            </div>
          ))}
          {stats.topEx.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">Sem treinos registrados</div>}
        </CardContent>
      </Card>
    </div>
  );
}
