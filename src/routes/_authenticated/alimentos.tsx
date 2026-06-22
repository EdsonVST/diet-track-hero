import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alimentos")({
  component: AlimentosPage,
});

type Food = {
  id: string;
  user_id: string | null;
  nome: string;
  categoria: string | null;
  unidade_base: string;
  energia_kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
  sodio: number;
  fonte: string;
};

function AlimentosPage() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const foodsQ = useQuery({
    queryKey: ["foods-list", search],
    queryFn: async () => {
      let q = supabase.from("foods").select("*").order("nome").limit(200);
      if (search.trim()) q = q.ilike("nome", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Food[];
    },
  });

  const userQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("foods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["foods-list"] });
      toast.success("Alimento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Tabela Nutricional</h1>
          <p className="text-sm text-muted-foreground">Alimentos da TACO e seus alimentos personalizados</p>
        </div>
        <FoodDialog onSaved={() => qc.invalidateQueries({ queryKey: ["foods-list"] })}>
          <Button><Plus className="h-4 w-4 mr-1" />Novo alimento</Button>
        </FoodDialog>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Pesquisar alimento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-3">
        {(foodsQ.data ?? []).map((f) => {
          const isMine = f.user_id && f.user_id === userQ.data?.id;
          return (
            <Card key={f.id}>
              <CardContent className="p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold truncate">{f.nome}</div>
                      <Badge variant={f.fonte === "taco" ? "secondary" : "default"} className="text-xs">
                        {f.fonte === "taco" ? "TACO" : "Pessoal"}
                      </Badge>
                      {f.categoria && <span className="text-xs text-muted-foreground">· {f.categoria}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Por 100{f.unidade_base === "un" ? "un" : f.unidade_base}: {f.energia_kcal} kcal · P {f.proteina}g · C {f.carboidrato}g · G {f.gordura}g · Fibra {f.fibra}g · Na {f.sodio}mg
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <FoodDialog food={f} onSaved={() => qc.invalidateQueries({ queryKey: ["foods-list"] })}>
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                    </FoodDialog>
                    {isMine && (
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(f.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {foodsQ.data && foodsQ.data.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">Nenhum alimento encontrado</div>
        )}
      </div>
    </div>
  );
}

function FoodDialog({ food, children, onSaved }: { food?: Food; children: React.ReactNode; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    nome: food?.nome ?? "",
    categoria: food?.categoria ?? "",
    unidade_base: food?.unidade_base ?? "g",
    energia_kcal: String(food?.energia_kcal ?? ""),
    proteina: String(food?.proteina ?? ""),
    carboidrato: String(food?.carboidrato ?? ""),
    gordura: String(food?.gordura ?? ""),
    fibra: String(food?.fibra ?? ""),
    sodio: String(food?.sodio ?? ""),
  }));

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome");
    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim() || null,
      unidade_base: form.unidade_base,
      energia_kcal: Number(form.energia_kcal) || 0,
      proteina: Number(form.proteina) || 0,
      carboidrato: Number(form.carboidrato) || 0,
      gordura: Number(form.gordura) || 0,
      fibra: Number(form.fibra) || 0,
      sodio: Number(form.sodio) || 0,
    };
    if (food) {
      const { error } = await supabase.from("foods").update(payload).eq("id", food.id);
      if (error) return toast.error(error.message);
      toast.success("Alimento atualizado");
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return toast.error("Não autenticado");
      const { error } = await supabase.from("foods").insert({ ...payload, user_id: u.user.id, fonte: "usuario" });
      if (error) return toast.error(error.message);
      toast.success("Alimento criado");
    }
    onSaved();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{food ? "Editar alimento" : "Novo alimento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nome"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria"><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></Field>
            <Field label="Unidade base">
              <Select value={form.unidade_base} onValueChange={(v) => setForm({ ...form, unidade_base: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">Gramas (g)</SelectItem>
                  <SelectItem value="ml">Mililitros (ml)</SelectItem>
                  <SelectItem value="un">Unidade</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="text-xs text-muted-foreground">Valores por 100{form.unidade_base === "un" ? " unidade" : form.unidade_base}:</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calorias (kcal)"><Input type="number" step="any" value={form.energia_kcal} onChange={(e) => setForm({ ...form, energia_kcal: e.target.value })} /></Field>
            <Field label="Proteína (g)"><Input type="number" step="any" value={form.proteina} onChange={(e) => setForm({ ...form, proteina: e.target.value })} /></Field>
            <Field label="Carboidrato (g)"><Input type="number" step="any" value={form.carboidrato} onChange={(e) => setForm({ ...form, carboidrato: e.target.value })} /></Field>
            <Field label="Gordura (g)"><Input type="number" step="any" value={form.gordura} onChange={(e) => setForm({ ...form, gordura: e.target.value })} /></Field>
            <Field label="Fibra (g)"><Input type="number" step="any" value={form.fibra} onChange={(e) => setForm({ ...form, fibra: e.target.value })} /></Field>
            <Field label="Sódio (mg)"><Input type="number" step="any" value={form.sodio} onChange={(e) => setForm({ ...form, sodio: e.target.value })} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
