import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Dumbbell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/meu-treino")({
  component: MeuTreinoPage,
});

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function MeuTreinoPage() {
  const [data, setData] = useState(today());
  const qc = useQueryClient();

  const workoutQ = useQuery({
    queryKey: ["workout", data],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: ws, error } = await supabase
        .from("workouts")
        .select("*, workout_exercises(*, exercises(nome, grupo_muscular))")
        .eq("user_id", u.user.id)
        .eq("data", data)
        .order("ordem", { ascending: true, referencedTable: "workout_exercises" })
        .maybeSingle();
      if (error) throw error;
      return ws;
    },
  });

  const exercisesQ = useQuery({
    queryKey: ["exercises-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("id,nome,grupo_muscular").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ensureWorkout = async () => {
    if (workoutQ.data) return workoutQ.data;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Não autenticado");
    const { data: ws, error } = await supabase.from("workouts").insert({ user_id: u.user.id, data }).select().single();
    if (error) throw error;
    return { ...ws, workout_exercises: [] };
  };

  const addEx = useMutation({
    mutationFn: async (payload: { exercise_id: string; peso: number; series: number; repeticoes: number; observacoes: string }) => {
      const w = await ensureWorkout();
      const ordem = (w as any).workout_exercises?.length ?? 0;
      const { error } = await supabase.from("workout_exercises").insert({ workout_id: w.id, ordem, ...payload });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workout"] }); toast.success("Exercício adicionado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delEx = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workout"] }); toast.success("Removido"); },
  });

  const updateWorkout = useMutation({
    mutationFn: async (patch: { horario?: string; duracao_min?: number; observacoes?: string }) => {
      const w = await ensureWorkout();
      const { error } = await supabase.from("workouts").update(patch).eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout"] }),
  });

  const w = workoutQ.data;
  const items = (w?.workout_exercises ?? []) as any[];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Meu Treino</h1>
          <p className="text-sm text-muted-foreground">Registre os exercícios da sua sessão</p>
        </div>
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-auto" />
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-3">
          <div><Label className="text-xs">Horário</Label><Input type="time" defaultValue={w?.horario ?? ""} onBlur={(e) => updateWorkout.mutate({ horario: e.target.value || undefined })} /></div>
          <div><Label className="text-xs">Duração (min)</Label><Input type="number" defaultValue={w?.duracao_min ?? ""} onBlur={(e) => updateWorkout.mutate({ duracao_min: Number(e.target.value) || undefined })} /></div>
          <div><Label className="text-xs">Observações</Label><Input defaultValue={w?.observacoes ?? ""} onBlur={(e) => updateWorkout.mutate({ observacoes: e.target.value || undefined })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Exercícios da sessão</CardTitle>
          <AddExerciseDialog exercises={exercisesQ.data ?? []} onAdd={(p) => addEx.mutate(p)} />
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center p-3 rounded-lg border">
              <div className="h-9 w-9 grid place-items-center rounded-lg bg-primary/10 text-primary"><Dumbbell className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="font-medium truncate">{it.exercises?.nome ?? "Exercício"}</div>
                <div className="text-xs text-muted-foreground">
                  {it.peso ? `${it.peso}kg · ` : ""}{it.series ?? 0} séries × {it.repeticoes ?? 0} reps
                  {it.observacoes ? ` · ${it.observacoes}` : ""}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => delEx.mutate(it.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {items.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">Nenhum exercício na sessão. Adicione o primeiro.</div>}
        </CardContent>
      </Card>

      {items.length > 0 && <ExerciseHistory items={items} />}
    </div>
  );
}

function ExerciseHistory({ items }: { items: any[] }) {
  const ids = Array.from(new Set(items.map((i) => i.exercise_id))).filter(Boolean) as string[];
  const histQ = useQuery({
    queryKey: ["ex-hist", ids.sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select("exercise_id, peso, created_at, workouts!inner(data, user_id)")
        .in("exercise_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = (exId: string) => {
    const recs = (histQ.data ?? []).filter((h: any) => h.exercise_id === exId && h.peso != null);
    const last = recs[0]?.peso ?? null;
    const best = recs.reduce((m: number, r: any) => Math.max(m, Number(r.peso) || 0), 0) || null;
    return { last, best };
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Histórico de cargas</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((it) => {
          const s = stats(it.exercise_id);
          return (
            <div key={it.id} className="grid grid-cols-3 gap-3 text-sm p-2 border-b last:border-0">
              <div className="font-medium truncate">{it.exercises?.nome}</div>
              <div className="text-xs"><span className="text-muted-foreground">Última: </span><span className="font-semibold">{s.last ? `${s.last}kg` : "—"}</span></div>
              <div className="text-xs"><span className="text-muted-foreground">Melhor: </span><span className="font-semibold">{s.best ? `${s.best}kg` : "—"}</span></div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AddExerciseDialog({ exercises, onAdd }: { exercises: Array<{ id: string; nome: string }>; onAdd: (p: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ exercise_id: "", peso: "", series: "", repeticoes: "", observacoes: "" });

  const submit = () => {
    if (!form.exercise_id) return toast.error("Selecione o exercício");
    onAdd({
      exercise_id: form.exercise_id,
      peso: Number(form.peso) || 0,
      series: Number(form.series) || 0,
      repeticoes: Number(form.repeticoes) || 0,
      observacoes: form.observacoes,
    });
    setForm({ exercise_id: "", peso: "", series: "", repeticoes: "", observacoes: "" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Adicionar</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar exercício</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Exercício</Label>
            <Select value={form.exercise_id} onValueChange={(v) => setForm({...form, exercise_id: v})}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {exercises.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Peso (kg)</Label><Input type="number" step="any" value={form.peso} onChange={(e) => setForm({...form, peso: e.target.value})} /></div>
            <div><Label className="text-xs">Séries</Label><Input type="number" value={form.series} onChange={(e) => setForm({...form, series: e.target.value})} /></div>
            <div><Label className="text-xs">Reps</Label><Input type="number" value={form.repeticoes} onChange={(e) => setForm({...form, repeticoes: e.target.value})} /></div>
          </div>
          <div><Label className="text-xs">Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Adicionar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
