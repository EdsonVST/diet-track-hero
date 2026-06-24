import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planejamento-semanal")({
  component: PlanejamentoPage,
});

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function PlanejamentoPage() {
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: ["weekly_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_plans").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const templates = useQuery({
    queryKey: ["workout_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workout_templates").select("id,nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentPlanId = selectedPlan ?? plans.data?.find((p) => p.ativo)?.id ?? plans.data?.[0]?.id ?? null;

  const days = useQuery({
    queryKey: ["weekly_plan_days", currentPlanId],
    enabled: !!currentPlanId,
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_plan_days").select("*").eq("plan_id", currentPlanId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createPlan = useMutation({
    mutationFn: async (nome: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("weekly_plans").insert({ user_id: u.user.id, nome, ativo: (plans.data?.length ?? 0) === 0 }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["weekly_plans"] }); setSelectedPlan(p.id); toast.success("Plano criado"); },
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("");
      await supabase.from("weekly_plans").update({ ativo: false }).eq("user_id", u.user.id);
      const { error } = await supabase.from("weekly_plans").update({ ativo: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weekly_plans"] }); toast.success("Plano ativado"); },
  });

  const removePlan = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("weekly_plans").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weekly_plans"] }); setSelectedPlan(null); toast.success("Removido"); },
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const src = plans.data?.find((p) => p.id === id);
      if (!src) return;
      const { data: u } = await supabase.auth.getUser();
      const { data: novo, error } = await supabase.from("weekly_plans").insert({ user_id: u.user!.id, nome: `${src.nome} (cópia)`, ativo: false }).select().single();
      if (error) throw error;
      const { data: srcDays } = await supabase.from("weekly_plan_days").select("*").eq("plan_id", id);
      if (srcDays && srcDays.length > 0) {
        await supabase.from("weekly_plan_days").insert(srcDays.map((d) => ({
          plan_id: novo.id, dia_semana: d.dia_semana, template_id: d.template_id, rotulo: d.rotulo,
        })));
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weekly_plans"] }); toast.success("Semana duplicada"); },
  });

  const setDay = useMutation({
    mutationFn: async ({ dia, template_id, rotulo }: { dia: number; template_id: string | null; rotulo: string | null }) => {
      if (!currentPlanId) throw new Error("Sem plano");
      const existing = days.data?.find((d) => d.dia_semana === dia);
      if (existing) {
        const { error } = await supabase.from("weekly_plan_days").update({ template_id, rotulo }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("weekly_plan_days").insert({ plan_id: currentPlanId, dia_semana: dia, template_id, rotulo });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly_plan_days", currentPlanId] }),
  });

  const [novoNome, setNovoNome] = useState("");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Planejamento Semanal</h1>
        <p className="text-sm text-muted-foreground">Associe modelos de treino aos dias da semana.</p>
      </div>

      <Card><CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
        <div>
          <Label className="text-xs">Plano atual</Label>
          <Select value={currentPlanId ?? ""} onValueChange={setSelectedPlan}>
            <SelectTrigger><SelectValue placeholder="Selecionar plano..." /></SelectTrigger>
            <SelectContent>{(plans.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.ativo ? "★" : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Novo plano..." value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="w-48" />
          <Button onClick={() => { if (!novoNome.trim()) return; createPlan.mutate(novoNome.trim()); setNovoNome(""); }}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-1">
          {currentPlanId && <>
            <Button variant="outline" size="sm" onClick={() => activate.mutate(currentPlanId)}><Check className="h-4 w-4 mr-1" />Ativar</Button>
            <Button variant="outline" size="sm" onClick={() => duplicate.mutate(currentPlanId)}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => { if (confirm("Remover plano?")) removePlan.mutate(currentPlanId); }}><Trash2 className="h-4 w-4" /></Button>
          </>}
        </div>
      </CardContent></Card>

      {currentPlanId && (
        <div className="grid gap-2">
          {DIAS.map((nome, idx) => {
            const d = days.data?.find((x) => x.dia_semana === idx);
            return (
              <Card key={idx}><CardContent className="p-3 grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
                <div className="font-semibold text-sm">{nome}</div>
                <Select value={d?.template_id ?? "rest"} onValueChange={(v) => setDay.mutate({ dia: idx, template_id: v === "rest" ? null : v, rotulo: d?.rotulo ?? null })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rest">— Descanso —</SelectItem>
                    {(templates.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Rótulo (ex: Cardio)" defaultValue={d?.rotulo ?? ""} onBlur={(e) => setDay.mutate({ dia: idx, template_id: d?.template_id ?? null, rotulo: e.target.value || null })} />
              </CardContent></Card>
            );
          })}
        </div>
      )}
      {plans.data && plans.data.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">Crie seu primeiro plano semanal acima.</div>
      )}
    </div>
  );
}
