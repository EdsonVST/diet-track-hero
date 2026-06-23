import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { VITAMIN_KEYS, MINERAL_KEYS, VITAMIN_LABELS, MINERAL_LABELS, MICRO_UNITS } from "@/lib/nutrition";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/alimentos")({
  component: AlimentosPage,
});

type Food = any;

const MICRO_KEYS = [...VITAMIN_KEYS, ...MINERAL_KEYS] as const;

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

  const userQ = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("foods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["foods-list"] }); toast.success("Alimento removido"); },
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
                    <FoodDetails food={f}>
                      <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                    </FoodDetails>
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

function FoodDetails({ food, children }: { food: Food; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const macros = [
    { name: "Proteína", value: Number(food.proteina) * 4, color: "hsl(var(--primary))" },
    { name: "Carboidrato", value: Number(food.carboidrato) * 4, color: "#f59e0b" },
    { name: "Gordura", value: Number(food.gordura) * 9, color: "#ef4444" },
  ].filter((m) => m.value > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{food.nome}</DialogTitle></DialogHeader>
        <div className="text-xs text-muted-foreground">Valores por 100{food.unidade_base === "un" ? " un" : food.unidade_base}</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-56">
            {macros.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={macros} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                    {macros.map((m, i) => <Cell key={i} fill={m.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${Math.round(v)} kcal`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="grid place-items-center h-full text-sm text-muted-foreground">Sem dados de macros</div>}
          </div>
          <div className="space-y-1 text-sm">
            <Row k="Calorias" v={`${food.energia_kcal} kcal`} />
            <Row k="Proteína" v={`${food.proteina} g`} />
            <Row k="Carboidrato" v={`${food.carboidrato} g`} />
            <Row k="Gordura" v={`${food.gordura} g`} />
            <Row k="Fibra" v={`${food.fibra} g`} />
          </div>
        </div>
        <Tabs defaultValue="vit" className="mt-2">
          <TabsList><TabsTrigger value="vit">Vitaminas</TabsTrigger><TabsTrigger value="min">Minerais</TabsTrigger></TabsList>
          <TabsContent value="vit" className="grid grid-cols-2 gap-1">
            {VITAMIN_KEYS.map((k) => <Row key={k} k={VITAMIN_LABELS[k]} v={`${food[k] ?? 0} ${MICRO_UNITS[k]}`} />)}
          </TabsContent>
          <TabsContent value="min" className="grid grid-cols-2 gap-1">
            {MINERAL_KEYS.map((k) => <Row key={k} k={MINERAL_LABELS[k]} v={`${food[k] ?? 0} ${MICRO_UNITS[k]}`} />)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-xs py-1 border-b last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}

function FoodDialog({ food, children, onSaved }: { food?: Food; children: React.ReactNode; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const initialMicros: Record<string, string> = {};
  for (const k of MICRO_KEYS) initialMicros[k] = String(food?.[k] ?? "");
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
    micros: initialMicros,
  }));

  const setMicro = (k: string, v: string) => setForm({ ...form, micros: { ...form.micros, [k]: v } });

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome");
    const payload: any = {
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
    for (const k of MICRO_KEYS) {
      if (k === "sodio") continue;
      payload[k] = form.micros[k] === "" ? null : Number(form.micros[k]) || 0;
    }
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
        <DialogHeader><DialogTitle>{food ? "Editar alimento" : "Novo alimento"}</DialogTitle></DialogHeader>
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
          <Tabs defaultValue="macros">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="macros">Macros</TabsTrigger>
              <TabsTrigger value="vit">Vitaminas</TabsTrigger>
              <TabsTrigger value="min">Minerais</TabsTrigger>
            </TabsList>
            <TabsContent value="macros" className="grid grid-cols-2 gap-3">
              <Field label="Calorias (kcal)"><Input type="number" step="any" value={form.energia_kcal} onChange={(e) => setForm({ ...form, energia_kcal: e.target.value })} /></Field>
              <Field label="Proteína (g)"><Input type="number" step="any" value={form.proteina} onChange={(e) => setForm({ ...form, proteina: e.target.value })} /></Field>
              <Field label="Carboidrato (g)"><Input type="number" step="any" value={form.carboidrato} onChange={(e) => setForm({ ...form, carboidrato: e.target.value })} /></Field>
              <Field label="Gordura (g)"><Input type="number" step="any" value={form.gordura} onChange={(e) => setForm({ ...form, gordura: e.target.value })} /></Field>
              <Field label="Fibra (g)"><Input type="number" step="any" value={form.fibra} onChange={(e) => setForm({ ...form, fibra: e.target.value })} /></Field>
              <Field label="Sódio (mg)"><Input type="number" step="any" value={form.sodio} onChange={(e) => setForm({ ...form, sodio: e.target.value })} /></Field>
            </TabsContent>
            <TabsContent value="vit" className="grid grid-cols-2 gap-3">
              {VITAMIN_KEYS.map((k) => (
                <Field key={k} label={`${VITAMIN_LABELS[k]} (${MICRO_UNITS[k]})`}>
                  <Input type="number" step="any" value={form.micros[k]} onChange={(e) => setMicro(k, e.target.value)} />
                </Field>
              ))}
            </TabsContent>
            <TabsContent value="min" className="grid grid-cols-2 gap-3">
              {MINERAL_KEYS.filter((k) => k !== "sodio").map((k) => (
                <Field key={k} label={`${MINERAL_LABELS[k]} (${MICRO_UNITS[k]})`}>
                  <Input type="number" step="any" value={form.micros[k]} onChange={(e) => setMicro(k, e.target.value)} />
                </Field>
              ))}
            </TabsContent>
          </Tabs>
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
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
