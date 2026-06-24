import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Dumbbell, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/treinos")({
  component: ExerciciosPage,
});

type Exercise = {
  id: string;
  nome: string;
  categoria_id: string | null;
  grupo_muscular: string | null;
  descricao: string | null;
  equipamento: string | null;
  ativo: boolean;
  user_id: string | null;
  fonte: string;
};

function ExerciciosPage() {
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const qc = useQueryClient();

  const cats = useQuery({
    queryKey: ["exercise-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercise_categories").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = useQuery({
    queryKey: ["exercises", search, categoriaFilter],
    queryFn: async () => {
      let q = supabase.from("exercises").select("*").order("nome").limit(300);
      if (search.trim()) q = q.ilike("nome", `%${search.trim()}%`);
      if (categoriaFilter !== "all") q = q.eq("categoria_id", categoriaFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Exercise[];
    },
  });

  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exercises"] }); toast.success("Exercício removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const catName = (id: string | null) => cats.data?.find((c) => c.id === id)?.nome ?? "";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Exercícios</h1>
          <p className="text-sm text-muted-foreground">Base de exercícios do sistema e personalizados</p>
        </div>
        <ExerciseDialog cats={cats.data ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["exercises"] })}>
          <Button><Plus className="h-4 w-4 mr-1" />Novo exercício</Button>
        </ExerciseDialog>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Pesquisar exercício..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {(list.data ?? []).map((e) => {
          const mine = e.user_id && e.user_id === me.data?.id;
          return (
            <Card key={e.id}>
              <CardContent className="p-4 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-start">
                <div className="h-10 w-10 grid place-items-center rounded-xl bg-primary/10 text-primary"><Dumbbell className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold truncate">{e.nome}</div>
                    <Badge variant={e.fonte === "sistema" ? "secondary" : "default"} className="text-xs">{e.fonte}</Badge>
                    {catName(e.categoria_id) && <span className="text-xs text-muted-foreground">· {catName(e.categoria_id)}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {e.grupo_muscular && <>Grupo: {e.grupo_muscular} · </>}
                    {e.equipamento && <>Equip.: {e.equipamento}</>}
                  </div>
                  {e.descricao && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.descricao}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <ExerciseDialog ex={e} cats={cats.data ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["exercises"] })}>
                    <Button variant="ghost" size="icon" title="Editar"><Pencil className="h-4 w-4" /></Button>
                  </ExerciseDialog>
                  <ExerciseDialog duplicateFrom={e} cats={cats.data ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["exercises"] })}>
                    <Button variant="ghost" size="icon" title="Duplicar"><Copy className="h-4 w-4" /></Button>
                  </ExerciseDialog>
                  {mine && (
                    <Button variant="ghost" size="icon" title="Excluir" onClick={() => { if (confirm("Excluir este exercício?")) del.mutate(e.id); }}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {list.data && list.data.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">Nenhum exercício encontrado</div>
        )}
      </div>
    </div>
  );
}

function ExerciseDialog({ ex, duplicateFrom, cats, children, onSaved }: { ex?: Exercise; duplicateFrom?: Exercise; cats: Array<{ id: string; nome: string }>; children: React.ReactNode; onSaved: () => void }) {
  const src = ex ?? duplicateFrom;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    nome: duplicateFrom ? `${duplicateFrom.nome} (cópia)` : (src?.nome ?? ""),
    categoria_id: src?.categoria_id ?? "",
    grupo_muscular: src?.grupo_muscular ?? "",
    equipamento: src?.equipamento ?? "",
    descricao: src?.descricao ?? "",
  }));

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome");
    const payload = {
      nome: form.nome.trim(),
      categoria_id: form.categoria_id || null,
      grupo_muscular: form.grupo_muscular.trim() || null,
      equipamento: form.equipamento.trim() || null,
      descricao: form.descricao.trim() || null,
    };
    if (ex) {
      const { error } = await supabase.from("exercises").update(payload).eq("id", ex.id);
      if (error) return toast.error(error.message);
      toast.success("Exercício atualizado");
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return toast.error("Não autenticado");
      const { error } = await supabase.from("exercises").insert({ ...payload, user_id: u.user.id, fonte: "usuario" });
      if (error) return toast.error(error.message);
      toast.success(duplicateFrom ? "Exercício duplicado" : "Exercício criado");
    }
    onSaved(); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{ex ? "Editar exercício" : "Novo exercício"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nome</Label><Input value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={form.categoria_id} onValueChange={(v) => setForm({...form, categoria_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Grupo muscular</Label><Input value={form.grupo_muscular} onChange={(e) => setForm({...form, grupo_muscular: e.target.value})} /></div>
          </div>
          <div><Label className="text-xs">Equipamento</Label><Input value={form.equipamento} onChange={(e) => setForm({...form, equipamento: e.target.value})} /></div>
          <div><Label className="text-xs">Descrição</Label><Textarea rows={3} value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
