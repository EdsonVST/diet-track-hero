import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Droplet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/hidratacao")({
  component: HidratacaoPage,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function HidratacaoPage() {
  const qc = useQueryClient();
  const today = todayISO();

  const goalQ = useQuery({
    queryKey: ["water_goal"],
    queryFn: async () => {
      const { data } = await supabase.from("water_goals").select("*").maybeSingle();
      return data;
    },
  });

  const logsQ = useQuery({
    queryKey: ["water_logs"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase.from("water_logs").select("*").gte("data", since.toISOString().slice(0, 10)).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const meta = goalQ.data?.meta_ml ?? 3000;
  const todayLogs = (logsQ.data ?? []).filter((l) => l.data === today);
  const consumido = todayLogs.reduce((s, l) => s + l.quantidade_ml, 0);
  const pct = Math.min(100, (consumido / meta) * 100);
  const restante = Math.max(0, meta - consumido);

  const setGoal = useMutation({
    mutationFn: async (litros: number) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("");
      const { error } = await supabase.from("water_goals").upsert({ user_id: u.user.id, meta_ml: Math.round(litros * 1000) });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["water_goal"] }); toast.success("Meta atualizada"); },
  });

  const add = useMutation({
    mutationFn: async (ml: number) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("");
      const { error } = await supabase.from("water_logs").insert({ user_id: u.user.id, data: today, quantidade_ml: ml });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water_logs"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("water_logs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water_logs"] }),
  });

  const [metaLitros, setMetaLitros] = useState((meta / 1000).toString());
  const [manual, setManual] = useState("");

  // Chart: last 14 days
  const chartData = (() => {
    const map = new Map<string, number>();
    for (const l of logsQ.data ?? []) map.set(l.data, (map.get(l.data) ?? 0) + l.quantidade_ml);
    const days: Array<{ data: string; ml: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      days.push({ data: k.slice(5), ml: map.get(k) ?? 0 });
    }
    return days;
  })();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Hidratação</h1>
        <p className="text-sm text-muted-foreground">Acompanhe seu consumo diário de água</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-6 text-center space-y-4">
          <Droplet className="h-12 w-12 mx-auto text-sky-500" />
          <div>
            <div className="text-4xl font-black">{(consumido / 1000).toFixed(2)}<span className="text-xl text-muted-foreground">L</span></div>
            <div className="text-sm text-muted-foreground">de {(meta / 1000).toFixed(2)}L · faltam {(restante / 1000).toFixed(2)}L</div>
          </div>
          <Progress value={pct} className="h-3" />
          <div className="text-xs text-muted-foreground">{pct.toFixed(0)}% da meta</div>
        </CardContent></Card>

        <Card><CardContent className="p-6 space-y-3">
          <div className="font-semibold">Adicionar consumo</div>
          <div className="grid grid-cols-4 gap-2">
            {[200, 300, 500, 1000].map((ml) => (
              <Button key={ml} variant="outline" onClick={() => add.mutate(ml)}>+{ml >= 1000 ? "1L" : `${ml}ml`}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input type="number" placeholder="Quantidade (ml)" value={manual} onChange={(e) => setManual(e.target.value)} />
            <Button onClick={() => { const v = Number(manual); if (v > 0) { add.mutate(v); setManual(""); } }}>Adicionar</Button>
          </div>
          <div className="border-t pt-3">
            <Label className="text-xs">Meta diária (litros)</Label>
            <div className="flex gap-2 mt-1">
              <Input type="number" step="0.1" value={metaLitros} onChange={(e) => setMetaLitros(e.target.value)} />
              <Button variant="outline" onClick={() => setGoal.mutate(Number(metaLitros))}>Salvar</Button>
            </div>
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimos 14 dias</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="ml" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Registros de hoje</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {todayLogs.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Nenhum registro hoje</div>}
          {todayLogs.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="text-sm">{l.quantidade_ml} ml · {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
