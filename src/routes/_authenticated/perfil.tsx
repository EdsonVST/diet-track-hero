import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nutrition_goals").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [p, setP] = useState({ nome: "", peso: "", altura: "", idade: "", objetivo: "manutencao" });
  const [g, setG] = useState({ calorias: "", proteinas: "", carboidratos: "", gorduras: "", fibras: "" });

  useEffect(() => {
    if (profileQ.data) {
      setP({
        nome: profileQ.data.nome ?? "",
        peso: profileQ.data.peso?.toString() ?? "",
        altura: profileQ.data.altura?.toString() ?? "",
        idade: profileQ.data.idade?.toString() ?? "",
        objetivo: profileQ.data.objetivo ?? "manutencao",
      });
    }
  }, [profileQ.data]);

  useEffect(() => {
    if (goalsQ.data) {
      setG({
        calorias: goalsQ.data.calorias?.toString() ?? "",
        proteinas: goalsQ.data.proteinas?.toString() ?? "",
        carboidratos: goalsQ.data.carboidratos?.toString() ?? "",
        gorduras: goalsQ.data.gorduras?.toString() ?? "",
        fibras: goalsQ.data.fibras?.toString() ?? "",
      });
    }
  }, [goalsQ.data]);

  const saveProfile = async () => {
    if (!p.nome.trim()) return toast.error("Informe o nome");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: u.user.id,
      nome: p.nome.trim(),
      peso: p.peso ? Number(p.peso) : null,
      altura: p.altura ? Number(p.altura) : null,
      idade: p.idade ? Number(p.idade) : null,
      objetivo: p.objetivo as any,
    });
    if (error) return toast.error(error.message);
    toast.success("Perfil salvo");
  };

  const saveGoals = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("nutrition_goals").upsert({
      user_id: u.user.id,
      calorias: Number(g.calorias) || 0,
      proteinas: Number(g.proteinas) || 0,
      carboidratos: Number(g.carboidratos) || 0,
      gorduras: Number(g.gorduras) || 0,
      fibras: Number(g.fibras) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Metas atualizadas");
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">Seus dados e metas nutricionais</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados pessoais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Peso (kg)</Label>
              <Input type="number" step="any" value={p.peso} onChange={(e) => setP({ ...p, peso: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Altura (cm)</Label>
              <Input type="number" step="any" value={p.altura} onChange={(e) => setP({ ...p, altura: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Idade</Label>
              <Input type="number" value={p.idade} onChange={(e) => setP({ ...p, idade: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objetivo</Label>
            <Select value={p.objetivo} onValueChange={(v) => setP({ ...p, objetivo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
                <SelectItem value="ganho_massa">Ganho de massa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveProfile}>Salvar perfil</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Metas diárias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Calorias (kcal)" value={g.calorias} onChange={(v) => setG({ ...g, calorias: v })} />
            <Field label="Proteínas (g)" value={g.proteinas} onChange={(v) => setG({ ...g, proteinas: v })} />
            <Field label="Carboidratos (g)" value={g.carboidratos} onChange={(v) => setG({ ...g, carboidratos: v })} />
            <Field label="Gorduras (g)" value={g.gorduras} onChange={(v) => setG({ ...g, gorduras: v })} />
            <Field label="Fibras (g)" value={g.fibras} onChange={(v) => setG({ ...g, fibras: v })} />
          </div>
          <Button onClick={saveGoals}>Salvar metas</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
