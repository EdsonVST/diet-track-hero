import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dumbbell, TrendingUp, TrendingDown, Save, Check, Pencil, Flag, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/treino-hoje")({
  component: TreinoHojePage,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TreinoHojePage() {
  const qc = useQueryClient();
  const dow = new Date().getDay();
  const today = todayISO();

  const activePlan = useQuery({
    queryKey: ["active-plan"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data } = await supabase.from("weekly_plans").select("*").eq("ativo", true).maybeSingle();
      return data;
    },
  });

  const dayQ = useQuery({
    queryKey: ["plan-day", activePlan.data?.id, dow],
    enabled: !!activePlan.data?.id,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data } = await supabase.from("weekly_plan_days").select("*,workout_templates(id,nome)").eq("plan_id", activePlan.data!.id).eq("dia_semana", dow).maybeSingle();
      return data;
    },
  });

  const templateId = dayQ.data?.template_id;

  const exercises = useQuery({
    queryKey: ["template-exercises-today", templateId],
    enabled: !!templateId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_exercises")
        .select("*,exercises(id,nome,grupo_muscular)")
        .eq("template_id", templateId!)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const sessionQ = useQuery({
    queryKey: ["workout-today", today],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data } = await supabase.from("workouts").select("*,workout_exercises(*)").eq("data", today).maybeSingle();
      return data;
    },
  });

  const createSession = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const nome = dayQ.data?.workout_templates?.nome ?? "Treino";
      const { data, error } = await supabase
        .from("workouts")
        .insert({ user_id: u.user.id, data: today, observacoes: nome, horario: new Date().toTimeString().slice(0, 5) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-today", today] });
      toast.success("Treino iniciado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalize = useMutation({
    mutationFn: async () => {
      if (!sessionQ.data?.id) throw new Error("Sem sessão");
      const inicio = sessionQ.data.horario ? new Date(`${today}T${sessionQ.data.horario}`) : new Date(sessionQ.data.created_at);
      const now = new Date();
      const duracao = Math.max(1, Math.round((now.getTime() - inicio.getTime()) / 60000));
      const { error } = await supabase
        .from("workouts")
        .update({ finalizado_em: now.toISOString(), duracao_min: duracao })
        .eq("id", sessionQ.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-today", today] });
      qc.invalidateQueries({ queryKey: ["all-workouts"] });
      toast.success("Treino finalizado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async () => {
      if (!sessionQ.data?.id) return;
      const { error } = await supabase.from("workouts").update({ finalizado_em: null }).eq("id", sessionQ.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-today", today] });
      toast.success("Treino reaberto");
    },
  });

  const sessionId = sessionQ.data?.id ?? null;
  const finalizado = !!sessionQ.data?.finalizado_em;

  if (activePlan.isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  if (!activePlan.data) return (
    <Card className="max-w-xl mx-auto"><CardContent className="p-8 text-center space-y-3">
      <div className="text-muted-foreground">Você não tem um plano semanal ativo.</div>
      <Button asChild><Link to="/planejamento-semanal">Criar plano semanal</Link></Button>
    </CardContent></Card>
  );

  if (!templateId) return (
    <Card className="max-w-xl mx-auto"><CardContent className="p-8 text-center">
      <div className="font-bold text-xl mb-2">{dayQ.data?.rotulo ?? "Dia de descanso"}</div>
      <p className="text-sm text-muted-foreground">Nenhum treino programado para hoje.</p>
    </CardContent></Card>
  );

  const totalEx = (exercises.data ?? []).length;
  const doneEx = ((sessionQ.data?.workout_exercises ?? []) as any[]).filter((e) => e.concluido).length;
  const allDone = totalEx > 0 && doneEx >= totalEx;

  const handleFinalize = () => {
    if (!allDone) {
      if (!confirm(`Você concluiu ${doneEx} de ${totalEx} exercícios. Finalizar mesmo assim?`)) return;
    }
    finalize.mutate();
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Treino de Hoje</h1>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {dayQ.data?.workout_templates?.nome}</p>
        </div>
        {sessionId && (
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">Progresso</div>
            <div className="text-lg font-bold">{doneEx}/{totalEx}</div>
          </div>
        )}
      </div>

      {!sessionId && (
        <Button onClick={() => createSession.mutate()} disabled={createSession.isPending} className="w-full">
          <Save className="h-4 w-4 mr-1" />{createSession.isPending ? "Iniciando..." : "Iniciar registro de hoje"}
        </Button>
      )}

      {sessionId && finalizado && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
            <div>
              <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><Check className="h-4 w-4" />Treino finalizado</div>
              <div className="text-xs text-muted-foreground">
                {new Date(sessionQ.data!.finalizado_em!).toLocaleString("pt-BR")} · {sessionQ.data?.duracao_min ?? 0} min
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => reopen.mutate()}><RotateCcw className="h-4 w-4 mr-1" />Reabrir</Button>
          </CardContent>
        </Card>
      )}

      {sessionId && (
        <>
          <div className="grid gap-3">
            {(exercises.data ?? []).map((te) => (
              <ExerciseLogger key={te.id} sessionId={sessionId} templateEx={te as any} locked={finalizado} />
            ))}
          </div>

          {!finalizado && (
            <Button onClick={handleFinalize} disabled={finalize.isPending} className="w-full" size="lg" variant={allDone ? "default" : "secondary"}>
              <Flag className="h-4 w-4 mr-1" />
              {finalize.isPending ? "Finalizando..." : "Finalizar treino"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function ExerciseLogger({ sessionId, templateEx, locked }: { sessionId: string; templateEx: { id: string; exercise_id: string; series: number; repeticoes: string; descanso_segundos: number; observacoes: string | null; exercises: { id: string; nome: string; grupo_muscular: string | null } | null }; locked: boolean }) {
  const qc = useQueryClient();

  const last = useQuery({
    queryKey: ["last-load", templateEx.exercise_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_exercises")
        .select("peso,series,repeticoes,workouts!inner(data,user_id)")
        .eq("exercise_id", templateEx.exercise_id)
        .neq("workout_id", sessionId)
        .order("workouts(data)", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const existing = useQuery({
    queryKey: ["session-ex", sessionId, templateEx.exercise_id],
    queryFn: async () => {
      const { data } = await supabase.from("workout_exercises").select("*").eq("workout_id", sessionId).eq("exercise_id", templateEx.exercise_id).maybeSingle();
      return data;
    },
  });

  const ex = existing.data;
  const concluido = !!ex?.concluido;
  const [editing, setEditing] = useState(false);
  const editable = !locked && (!concluido || editing);

  const [peso, setPeso] = useState<string>("");
  const [series, setSeries] = useState<string>("");
  const [reps, setReps] = useState<string>("");
  const [obs, setObs] = useState<string>("");

  const pesoVal = peso !== "" ? Number(peso) : (ex?.peso ?? null);
  const seriesVal = series !== "" ? Number(series) : (ex?.series ?? templateEx.series);
  const repsVal = reps !== "" ? Number(reps) : ((ex?.repeticoes ?? Number(templateEx.repeticoes)) || 10);
  const obsVal = obs || ex?.observacoes || "";

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        workout_id: sessionId,
        exercise_id: templateEx.exercise_id,
        peso: pesoVal,
        series: Number(seriesVal),
        repeticoes: Number(repsVal),
        observacoes: obsVal || null,
        ordem: 0,
        concluido: true,
      };
      if (ex) {
        const { error } = await supabase.from("workout_exercises").update(payload).eq("id", ex.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workout_exercises").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Registrado");
      setEditing(false);
      setPeso(""); setSeries(""); setReps(""); setObs("");
      qc.invalidateQueries({ queryKey: ["session-ex", sessionId, templateEx.exercise_id] });
      qc.invalidateQueries({ queryKey: ["workout-today"] });
      qc.invalidateQueries({ queryKey: ["last-load", templateEx.exercise_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delta = last.data?.peso != null && pesoVal != null ? Number(pesoVal) - Number(last.data.peso) : null;

  return (
    <Card className={concluido ? "border-emerald-500/40 bg-emerald-500/5 opacity-90" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {concluido ? <Check className="h-4 w-4 text-emerald-600" /> : <Dumbbell className="h-4 w-4" />}
          <span className={concluido ? "line-through decoration-emerald-600/50 decoration-2" : ""}>{templateEx.exercises?.nome}</span>
          {concluido && <span className="ml-auto text-xs font-normal text-emerald-700 dark:text-emerald-400">Concluído</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">Programado: {templateEx.series} séries × {templateEx.repeticoes} reps · {templateEx.descanso_segundos}s descanso</div>
        {last.data && (
          <div className="text-xs">Último: <span className="font-semibold">{last.data.peso ?? 0}kg × {last.data.series}×{last.data.repeticoes}</span></div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-xs">Peso (kg)</Label><Input type="number" step="0.5" disabled={!editable} value={peso} placeholder={String(ex?.peso ?? "")} onChange={(e) => setPeso(e.target.value)} /></div>
          <div><Label className="text-xs">Séries</Label><Input type="number" disabled={!editable} value={series} placeholder={String(ex?.series ?? templateEx.series)} onChange={(e) => setSeries(e.target.value)} /></div>
          <div><Label className="text-xs">Reps</Label><Input type="number" disabled={!editable} value={reps} placeholder={String(ex?.repeticoes ?? templateEx.repeticoes)} onChange={(e) => setReps(e.target.value)} /></div>
        </div>
        <Textarea rows={1} disabled={!editable} placeholder="Observações" value={obs} onChange={(e) => setObs(e.target.value)} />
        <div className="flex items-center justify-between gap-2">
          {delta !== null && delta !== 0 && (
            <div className={`text-sm font-semibold flex items-center gap-1 ${delta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {delta > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {delta > 0 ? "+" : ""}{delta.toFixed(1)}kg vs último
            </div>
          )}
          {!locked && (
            editable ? (
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="ml-auto">
                <Save className="h-4 w-4 mr-1" />{save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="ml-auto">
                <Pencil className="h-4 w-4 mr-1" />Editar
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
