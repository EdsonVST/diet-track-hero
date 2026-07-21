import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileDown, FileSpreadsheet, Calendar as CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/historico-treinos")({
  component: HistoricoPage,
});

function isoDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function HistoricoPage() {
  const [exerciseId, setExerciseId] = useState<string>("");
  const [from, setFrom] = useState<string>(isoDaysAgo(30));
  const [to, setTo] = useState<string>(isoDaysAgo(0));
  const [detailDate, setDetailDate] = useState<string>("");

  const exercisesQ = useQuery({
    queryKey: ["exercises-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("id,nome,grupo_muscular").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const workoutsQ = useQuery({
    queryKey: ["all-workouts", from, to],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("workouts")
        .select("id, data, duracao_min, observacoes, finalizado_em, workout_exercises(id, peso, series, repeticoes, observacoes, exercise_id, exercises(nome, grupo_muscular))")
        .eq("user_id", u.user.id)
        .gte("data", from)
        .lte("data", to)
        .order("data", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const workouts = workoutsQ.data ?? [];

  const stats = useMemo(() => {
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
    const now = new Date();
    const freqData: { semana: string; treinos: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now); end.setDate(end.getDate() - i * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      const count = workouts.filter((w) => { const d = new Date(w.data); return d >= start && d <= end; }).length;
      freqData.push({ semana: `${start.getDate()}/${start.getMonth() + 1}`, treinos: count });
    }
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

  const detail = useMemo(() => workouts.find((w) => w.data === detailDate) ?? null, [workouts, detailDate]);

  const buildRows = () => {
    const rows: any[] = [];
    for (const w of workouts) {
      for (const we of (w.workout_exercises ?? []) as any[]) {
        rows.push({
          Data: w.data,
          Treino: w.observacoes ?? "",
          Duracao_min: w.duracao_min ?? "",
          Finalizado: w.finalizado_em ? "Sim" : "Não",
          Exercicio: we.exercises?.nome ?? "",
          Grupo: we.exercises?.grupo_muscular ?? "",
          Peso_kg: we.peso ?? 0,
          Series: we.series ?? 0,
          Reps: we.repeticoes ?? 0,
          Volume: (Number(we.peso) || 0) * (Number(we.series) || 0) * (Number(we.repeticoes) || 0),
          Observacoes: we.observacoes ?? "",
        });
      }
    }
    return rows;
  };

  const exportFile = (format: "xlsx" | "ods" | "csv") => {
    const rows = buildRows();
    if (rows.length === 0) return toast.error("Sem dados no período");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Treinos");
    const name = `historico_treinos_${from}_a_${to}.${format}`;
    XLSX.writeFile(wb, name, { bookType: format });
    toast.success(`Exportado: ${name}`);
  };

  const workoutDates = Array.from(new Set(workouts.map((w) => w.data)));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Histórico de Treinos</h1>
        <p className="text-sm text-muted-foreground">Evolução, estatísticas e exportação</p>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-[auto_auto_1fr_auto_auto_auto] items-end">
          <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="flex flex-wrap gap-1">
            {[7, 30, 90].map((n) => (
              <Button key={n} variant="outline" size="sm" onClick={() => { setFrom(isoDaysAgo(n)); setTo(isoDaysAgo(0)); }}>{n}d</Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => exportFile("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={() => exportFile("ods")}><FileSpreadsheet className="h-4 w-4 mr-1" />ODS</Button>
          <Button variant="outline" size="sm" onClick={() => exportFile("csv")}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { l: "Treinos no período", v: stats.total },
          { l: "Tempo médio", v: `${stats.tempoMedio} min` },
          { l: "Exercícios distintos", v: stats.topEx.length },
          { l: "Grupos musculares", v: stats.grupoData.length },
        ].map((s) => (
          <Card key={s.l}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{s.l}</div>
            <div className="text-2xl font-bold mt-1">{s.v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2"><CalendarIcon className="h-4 w-4" />Detalhes por data</CardTitle>
          <Select value={detailDate} onValueChange={setDetailDate}>
            <SelectTrigger className="max-w-xs"><SelectValue placeholder="Escolha uma data" /></SelectTrigger>
            <SelectContent>
              {workoutDates.map((d) => <SelectItem key={d} value={d}>{new Date(d).toLocaleDateString("pt-BR")}</SelectItem>)}
              {workoutDates.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sem treinos no período</div>}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {detail ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{detail.observacoes ?? "Treino"} · {detail.duracao_min ? `${detail.duracao_min} min` : "sem duração"} · {detail.finalizado_em ? "Finalizado" : "Em andamento"}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr><th className="text-left py-2">Exercício</th><th className="text-left">Grupo</th><th className="text-right">Peso</th><th className="text-right">Séries</th><th className="text-right">Reps</th><th className="text-right">Volume</th></tr>
                  </thead>
                  <tbody>
                    {(detail.workout_exercises as any[]).map((we) => (
                      <tr key={we.id} className="border-b last:border-0">
                        <td className="py-2">{we.exercises?.nome}</td>
                        <td className="text-muted-foreground">{we.exercises?.grupo_muscular ?? "—"}</td>
                        <td className="text-right">{we.peso ?? 0}kg</td>
                        <td className="text-right">{we.series ?? 0}</td>
                        <td className="text-right">{we.repeticoes ?? 0}</td>
                        <td className="text-right font-medium">{Math.round((Number(we.peso) || 0) * (Number(we.series) || 0) * (Number(we.repeticoes) || 0))}</td>
                      </tr>
                    ))}
                    {(detail.workout_exercises as any[]).length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Nenhum exercício registrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-6">Selecione uma data para ver os exercícios registrados</div>
          )}
        </CardContent>
      </Card>

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
                Variação no período: <span className={`font-bold ${evoPct >= 0 ? "text-primary" : "text-destructive"}`}>{evoPct > 0 ? "+" : ""}{evoPct}%</span>
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
                <Bar dataKey="treinos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
                <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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
              <div className="font-medium">{i + 1}. {e.nome}</div>
              <div className="text-sm text-muted-foreground">{e.vezes}x</div>
            </div>
          ))}
          {stats.topEx.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">Sem treinos no período</div>}
        </CardContent>
      </Card>
    </div>
  );
}
