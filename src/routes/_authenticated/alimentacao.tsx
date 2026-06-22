import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { computeNutrients, emptyTotals, sumTotals, MEAL_LABELS, DEFAULT_MEAL_TYPES } from "@/lib/nutrition";

export const Route = createFileRoute("/_authenticated/alimentacao")({
  component: AlimentacaoPage,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AlimentacaoPage() {
  const [date, setDate] = useState(todayISO());
  const qc = useQueryClient();

  const mealsQ = useQuery({
    queryKey: ["meals", date],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];
      const { data, error } = await supabase
        .from("meals")
        .select("id,tipo,horario,meal_foods(id,quantidade,food_id,foods(id,nome,unidade_base,energia_kcal,proteina,carboidrato,gordura,fibra,sodio))")
        .eq("data", date)
        .order("horario", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addFood = useMutation({
    mutationFn: async ({ tipo, foodId, quantidade, horario }: { tipo: string; foodId: string; quantidade: number; horario: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Não autenticado");
      // garante meal
      const existing = (mealsQ.data ?? []).find((m) => m.tipo === tipo);
      let mealId = existing?.id;
      if (!mealId) {
        const { data: m, error } = await supabase
          .from("meals")
          .insert({ user_id: user.id, data: date, tipo: tipo as any, horario })
          .select("id")
          .single();
        if (error) throw error;
        mealId = m.id;
      } else if (horario && !existing?.horario) {
        await supabase.from("meals").update({ horario }).eq("id", mealId);
      }
      const { error: e2 } = await supabase
        .from("meal_foods")
        .insert({ meal_id: mealId, food_id: foodId, quantidade });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals", date] });
      qc.invalidateQueries({ queryKey: ["meals-today"] });
      toast.success("Alimento adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFood = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_foods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals", date] });
      qc.invalidateQueries({ queryKey: ["meals-today"] });
    },
  });

  const removeMeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals", date] }),
  });

  const mealsByType = useMemo(() => {
    const map: Record<string, (typeof mealsQ.data extends (infer T)[] | undefined ? T : never) | undefined> = {};
    for (const m of mealsQ.data ?? []) map[m.tipo] = m;
    return map;
  }, [mealsQ.data]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Minha Alimentação</h1>
          <p className="text-sm text-muted-foreground">Registre seus alimentos do dia</p>
        </div>
        <div className="shrink-0">
          <Label htmlFor="date" className="text-xs">Data</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      {DEFAULT_MEAL_TYPES.map((tipo) => {
        const meal = mealsByType[tipo];
        let totals = emptyTotals();
        for (const mf of meal?.meal_foods ?? []) {
          if (!mf.foods) continue;
          totals = sumTotals(totals, computeNutrients(mf.foods as any, Number(mf.quantidade)));
        }
        return (
          <Card key={tipo}>
            <CardHeader className="pb-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-lg">{MEAL_LABELS[tipo]}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {totals.calorias} kcal · P {totals.proteina}g · C {totals.carboidrato}g · G {totals.gordura}g
                  </div>
                </div>
                <AddFoodDialog
                  onAdd={(foodId, quantidade, horario) => addFood.mutate({ tipo, foodId, quantidade, horario })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(meal?.meal_foods ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-2">Nenhum alimento adicionado</div>
              ) : (
                (meal?.meal_foods ?? []).map((mf: any) => {
                  const n = computeNutrients(mf.foods, Number(mf.quantidade));
                  return (
                    <div key={mf.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{mf.foods?.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {mf.quantidade}{mf.foods?.unidade_base} · {n.calorias} kcal · P {n.proteina}g · C {n.carboidrato}g · G {n.gordura}g
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFood.mutate(mf.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
              {meal && (meal.meal_foods ?? []).length === 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => removeMeal.mutate(meal.id)}>
                  Remover refeição vazia
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AddFoodDialog({ onAdd }: { onAdd: (foodId: string, quantidade: number, horario: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; nome: string; unidade_base: string } | null>(null);
  const [qty, setQty] = useState("100");
  const [horario, setHorario] = useState("");

  const foodsQ = useQuery({
    queryKey: ["foods-search", search],
    queryFn: async () => {
      let query = supabase.from("foods").select("id,nome,categoria,unidade_base").order("nome").limit(40);
      if (search.trim()) query = query.ilike("nome", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const reset = () => {
    setSearch("");
    setSelected(null);
    setQty("100");
    setHorario("");
  };

  const handleAdd = () => {
    if (!selected) return toast.error("Selecione um alimento");
    const q = Number(qty);
    if (!q || q <= 0) return toast.error("Quantidade inválida");
    onAdd(selected.id, q, horario || null);
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar alimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Pesquisar alimento..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
              className="pl-9"
            />
          </div>
          {!selected ? (
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {(foodsQ.data ?? []).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelected({ id: f.id, nome: f.nome, unidade_base: f.unidade_base })}
                  className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                >
                  <div className="font-medium text-sm">{f.nome}</div>
                  <div className="text-xs text-muted-foreground">{f.categoria}</div>
                </button>
              ))}
              {(foodsQ.data ?? []).length === 0 && !foodsQ.isLoading && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum alimento encontrado</div>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-3 bg-muted/40">
              <div className="font-medium">{selected.nome}</div>
              <div className="text-xs text-muted-foreground">Unidade: {selected.unidade_base}</div>
              <button onClick={() => setSelected(null)} className="text-xs text-primary mt-1">Trocar</button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Quantidade ({selected?.unidade_base || "g"})</Label>
              <Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horário (opcional)</Label>
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleAdd}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
