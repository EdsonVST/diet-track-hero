import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Copy, ChevronDown, ChevronUp, Dumbbell, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/modelos-treino")({
  component: ModelosTreinoPage,
});

type Template = { id: string; nome: string; descricao: string | null; objetivo: string | null; ativo: boolean };
type TemplateEx = {
  id: string; template_id: string; exercise_id: string; ordem: number;
  series: number; repeticoes: string; descanso_segundos: number; observacoes: string | null;
  exercises: { id: string; nome: string; grupo_muscular: string | null } | null;
};

function ModelosTreinoPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["workout_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workout_templates").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const exercises = useQuery({
    queryKey: ["exercises-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("id,nome,grupo_muscular").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const delTpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workout_templates"] }); toast.success("Modelo removido"); },
  });

  const duplicate = useMutation({
    mutationFn: async (t: Template) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { data: ins, error } = await supabase.from("workout_templates").insert({
        user_id: u.user.id, nome: `${t.nome} (cópia)`, descricao: t.descricao, objetivo: t.objetivo, ativo: true,
      }).select().single();
      if (error) throw error;
      const { data: exs } = await supabase.from("template_exercises").select("*").eq("template_id", t.id);
      if (exs && exs.length > 0) {
        await supabase.from("template_exercises").insert(exs.map((e) => ({
          template_id: ins.id, exercise_id: e.exercise_id, ordem: e.ordem,
          series: e.series, repeticoes: e.repeticoes, descanso_segundos: e.descanso_segundos, observacoes: e.observacoes,
        })));
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workout_templates"] }); toast.success("Modelo duplicado"); },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Modelos de Treino</h1>
          <p className="text-sm text-muted-foreground">Crie divisões reutilizáveis: Treino A/B/C, Push/Pull/Legs, Full Body...</p>
        </div>
        <TemplateDialog onSaved={() => qc.invalidateQueries({ queryKey: ["workout_templates"] })}>
          <Button><Plus className="h-4 w-4 mr-1" />Novo modelo</Button>
        </TemplateDialog>
      </div>

      <div className="grid gap-3">
        {(templates.data ?? []).map((t) => (
          <Card key={t.id}>
            <CardContent className="p-0">
              <div className="p-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                <button className="text-left min-w-0" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                  <div className="font-semibold flex items-center gap-2">{t.nome} {expanded === t.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
                  {t.objetivo && <div className="text-xs text-muted-foreground">Objetivo: {t.objetivo}</div>}
                  {t.descricao && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.descricao}</div>}
                </button>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" title="Duplicar" onClick={() => duplicate.mutate(t)}><Copy className="h-4 w-4" /></Button>
                  <TemplateDialog tpl={t} onSaved={() => qc.invalidateQueries({ queryKey: ["workout_templates"] })}>
                    <Button variant="ghost" size="icon" title="Editar"><Pencil className="h-4 w-4" /></Button>
                  </TemplateDialog>
                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => { if (confirm("Excluir modelo?")) delTpl.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {expanded === t.id && (
                <TemplateExercises templateId={t.id} exercises={exercises.data ?? []} allTemplates={templates.data ?? []} />
              )}
            </CardContent>
          </Card>
        ))}
        {templates.data && templates.data.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">Crie seu primeiro modelo de treino.</div>
        )}
      </div>
    </div>
  );
}

function TemplateDialog({ tpl, children, onSaved }: { tpl?: Template; children: React.ReactNode; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: tpl?.nome ?? "", descricao: tpl?.descricao ?? "", objetivo: tpl?.objetivo ?? "" });

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (tpl) {
      const { error } = await supabase.from("workout_templates").update(form).eq("id", tpl.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return toast.error("Não autenticado");
      const { error } = await supabase.from("workout_templates").insert({ ...form, user_id: u.user.id });
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo"); onSaved(); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tpl ? "Editar modelo" : "Novo modelo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Treino A — Peito/Tríceps" /></div>
          <div><Label className="text-xs">Objetivo</Label><Input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Ex: Hipertrofia" /></div>
          <div><Label className="text-xs">Descrição</Label><Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateExercises({ templateId, exercises, allTemplates }: { templateId: string; exercises: Array<{ id: string; nome: string; grupo_muscular: string | null }>; allTemplates: Template[] }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["template_exercises", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_exercises")
        .select("*,exercises(id,nome,grupo_muscular)")
        .eq("template_id", templateId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as TemplateEx[];
    },
  });

  const add = useMutation({
    mutationFn: async (payload: { exercise_id: string; series: number; repeticoes: string; descanso_segundos: number; observacoes: string }) => {
      const ordem = (list.data?.length ?? 0);
      const { error } = await supabase.from("template_exercises").insert({ template_id: templateId, ordem, ...payload });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template_exercises", templateId] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { series?: number; repeticoes?: string; descanso_segundos?: number; observacoes?: string | null } }) => {
      const { error } = await supabase.from("template_exercises").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template_exercises", templateId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("template_exercises").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template_exercises", templateId] }),
  });

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const items = list.data ?? [];
      const idx = items.findIndex((i) => i.id === id);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) return;
      const a = items[idx], b = items[swapIdx];
      await supabase.from("template_exercises").update({ ordem: b.ordem }).eq("id", a.id);
      await supabase.from("template_exercises").update({ ordem: a.ordem }).eq("id", b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template_exercises", templateId] }),
  });

  const importFrom = useMutation({
    mutationFn: async (fromId: string) => {
      const { data: exs } = await supabase.from("template_exercises").select("*").eq("template_id", fromId);
      if (!exs || exs.length === 0) return;
      const start = list.data?.length ?? 0;
      await supabase.from("template_exercises").insert(exs.map((e, i) => ({
        template_id: templateId, exercise_id: e.exercise_id, ordem: start + i,
        series: e.series, repeticoes: e.repeticoes, descanso_segundos: e.descanso_segundos, observacoes: e.observacoes,
      })));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template_exercises", templateId] }); toast.success("Exercícios importados"); },
  });

  const [newExId, setNewExId] = useState("");
  const [newSeries, setNewSeries] = useState(4);
  const [newReps, setNewReps] = useState("10");
  const [newDesc, setNewDesc] = useState(60);
  const [newObs, setNewObs] = useState("");

  return (
    <div className="border-t bg-muted/30 p-4 space-y-3">
      <div className="space-y-2">
        {(list.data ?? []).map((te, i) => (
          <div key={te.id} className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-2 items-center bg-background rounded-lg p-2 border">
            <div className="flex flex-col">
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} title="Mover para cima" onClick={() => reorder.mutate({ id: te.id, dir: -1 })}><ArrowUp className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === (list.data?.length ?? 0) - 1} title="Mover para baixo" onClick={() => reorder.mutate({ id: te.id, dir: 1 })}><ArrowDown className="h-3 w-3" /></Button>
            </div>
            <div className="h-8 w-8 grid place-items-center rounded-md bg-primary/10 text-primary"><Dumbbell className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{i + 1}. {te.exercises?.nome}</div>
              <div className="text-xs text-muted-foreground">
                <input type="number" defaultValue={te.series} onBlur={(e) => update.mutate({ id: te.id, patch: { series: Number(e.target.value) } })} className="w-12 bg-transparent border rounded px-1" /> séries ·{" "}
                <input type="text" defaultValue={te.repeticoes} onBlur={(e) => update.mutate({ id: te.id, patch: { repeticoes: e.target.value } })} className="w-16 bg-transparent border rounded px-1" /> reps ·{" "}
                <input type="number" defaultValue={te.descanso_segundos} onBlur={(e) => update.mutate({ id: te.id, patch: { descanso_segundos: Number(e.target.value) } })} className="w-14 bg-transparent border rounded px-1" />s descanso
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove.mutate(te.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto] items-end p-3 rounded-lg border bg-background">
        <div>
          <Label className="text-xs">Exercício</Label>
          <Select value={newExId} onValueChange={setNewExId}>
            <SelectTrigger><SelectValue placeholder="Selecionar exercício..." /></SelectTrigger>
            <SelectContent>{exercises.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Séries</Label><Input type="number" className="w-20" value={newSeries} onChange={(e) => setNewSeries(Number(e.target.value))} /></div>
        <div><Label className="text-xs">Reps</Label><Input className="w-20" value={newReps} onChange={(e) => setNewReps(e.target.value)} /></div>
        <div><Label className="text-xs">Descanso(s)</Label><Input type="number" className="w-24" value={newDesc} onChange={(e) => setNewDesc(Number(e.target.value))} /></div>
        <Button onClick={() => {
          if (!newExId) return toast.error("Escolha um exercício");
          add.mutate({ exercise_id: newExId, series: newSeries, repeticoes: newReps, descanso_segundos: newDesc, observacoes: newObs });
          setNewExId(""); setNewObs("");
        }}><Plus className="h-4 w-4" /></Button>
      </div>

      {allTemplates.filter((t) => t.id !== templateId).length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Importar de outro modelo:</Label>
          <Select onValueChange={(v) => importFrom.mutate(v)}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>{allTemplates.filter((t) => t.id !== templateId).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
