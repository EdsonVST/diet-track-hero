import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { buildRows, totalsByDay, totalsByMeal, totalsOverall, topFoods, exportCSV, exportXLSX, exportPDF, type MealRow } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

type Preset = "hoje" | "7d" | "30d" | "mes" | "ano" | "custom";

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function rangeFor(preset: Preset, custom: { from: string; to: string }): { from: string; to: string; label: string } {
  const now = new Date();
  const today = fmt(now);
  switch (preset) {
    case "hoje": return { from: today, to: today, label: "Hoje" };
    case "7d": { const d = new Date(now); d.setDate(d.getDate()-6); return { from: fmt(d), to: today, label: "Últimos 7 dias" }; }
    case "30d": { const d = new Date(now); d.setDate(d.getDate()-29); return { from: fmt(d), to: today, label: "Últimos 30 dias" }; }
    case "mes": { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { from: fmt(d), to: today, label: `Mês atual (${d.toLocaleDateString("pt-BR",{month:"long"})})` }; }
    case "ano": { const d = new Date(now.getFullYear(), 0, 1); return { from: fmt(d), to: today, label: `Ano ${now.getFullYear()}` }; }
    case "custom": return { from: custom.from || today, to: custom.to || today, label: `${custom.from} a ${custom.to}` };
  }
}

function RelatoriosPage() {
  const [preset, setPreset] = useState<Preset>("7d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);

  const profileQ = useQuery({
    queryKey: ["profile-name"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { nome: "Usuário", email: "" };
      const { data } = await supabase.from("profiles").select("nome").eq("id", u.user.id).maybeSingle();
      return { nome: data?.nome ?? u.user.email ?? "Usuário", email: u.user.email ?? "" };
    },
  });

  const mealsQ = useQuery({
    queryKey: ["report-meals", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meals")
        .select("id,data,tipo,horario,meal_foods(id,quantidade,foods(*))")
        .gte("data", range.from)
        .lte("data", range.to)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MealRow[];
    },
  });

  const rows = useMemo(() => buildRows(mealsQ.data ?? []), [mealsQ.data]);
  const byDay = useMemo(() => totalsByDay(rows), [rows]);
  const byMeal = useMemo(() => totalsByMeal(rows), [rows]);
  const top = useMemo(() => topFoods(rows), [rows]);
  const overall = useMemo(() => totalsOverall(rows), [rows]);

  const meta = {
    nome: profileQ.data?.nome ?? "Usuário",
    periodo: range.label,
    geradoEm: new Date().toLocaleString("pt-BR"),
  };
  const fileName = `nutricontrol_${range.from}_a_${range.to}`;

  const exportar = (tipo: "pdf" | "xlsx" | "csv") => {
    if (rows.length === 0) return;
    if (tipo === "csv") exportCSV(rows, fileName);
    if (tipo === "xlsx") exportXLSX(rows, fileName, meta);
    if (tipo === "pdf") exportPDF(rows, fileName, meta, overall);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Análise e exportação da sua alimentação</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {([
              ["hoje","Hoje"],["7d","7 dias"],["30d","30 dias"],["mes","Mês atual"],["ano","Ano atual"],["custom","Personalizado"],
            ] as Array<[Preset,string]>).map(([k,l]) => (
              <Button key={k} variant={preset === k ? "default" : "outline"} size="sm" onClick={() => setPreset(k)}>{l}</Button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <div><Label className="text-xs">De</Label><Input type="date" value={custom.from} onChange={(e) => setCustom({...custom, from: e.target.value})} /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={custom.to} onChange={(e) => setCustom({...custom, to: e.target.value})} /></div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" disabled={rows.length===0} onClick={() => exportar("pdf")}><FileText className="h-4 w-4 mr-1" />PDF</Button>
            <Button size="sm" variant="outline" disabled={rows.length===0} onClick={() => exportar("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            <Button size="sm" variant="outline" disabled={rows.length===0} onClick={() => exportar("csv")}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {[
          { l: "Calorias", v: overall.calorias, u: "kcal" },
          { l: "Proteínas", v: overall.proteina, u: "g" },
          { l: "Carboidratos", v: overall.carboidrato, u: "g" },
          { l: "Gorduras", v: overall.gordura, u: "g" },
          { l: "Fibras", v: overall.fibra, u: "g" },
        ].map((s) => (
          <Card key={s.l}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{s.l}</div>
            <div className="text-xl font-bold mt-1">{s.v} <span className="text-xs font-medium text-muted-foreground">{s.u}</span></div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="graficos">
        <TabsList>
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
          <TabsTrigger value="refeicoes">Por refeição</TabsTrigger>
          <TabsTrigger value="alimentos">Mais consumidos</TabsTrigger>
        </TabsList>

        <TabsContent value="graficos" className="space-y-4">
          {(["calorias","proteina","carboidrato","gordura","fibra"] as const).map((k) => (
            <Card key={k}>
              <CardHeader><CardTitle className="text-base capitalize">Evolução — {k}</CardTitle></CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer>
                  <LineChart data={byDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey={k} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="refeicoes">
          <Card><CardContent className="p-0">
            <div className="grid grid-cols-6 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
              <div className="col-span-2">Refeição</div><div>Itens</div><div>Kcal</div><div>P/C/G</div><div>Fibra</div>
            </div>
            {byMeal.map((m) => (
              <div key={m.tipo} className="grid grid-cols-6 px-4 py-3 text-sm border-b last:border-0">
                <div className="col-span-2 font-medium">{m.tipo}</div>
                <div>{m.count}</div>
                <div>{m.totals.calorias}</div>
                <div className="text-xs">{m.totals.proteina}/{m.totals.carboidrato}/{m.totals.gordura}g</div>
                <div>{m.totals.fibra}g</div>
              </div>
            ))}
            {byMeal.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Sem dados no período</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="alimentos">
          <Card><CardContent className="p-0">
            <div className="grid grid-cols-[1fr_auto_auto] px-4 py-2 text-xs font-medium text-muted-foreground border-b gap-4">
              <div>Alimento</div><div>Qtd total</div><div>Vezes</div>
            </div>
            {top.map((t, i) => (
              <div key={t.nome} className="grid grid-cols-[1fr_auto_auto] px-4 py-3 text-sm border-b last:border-0 gap-4">
                <div className="font-medium">{i+1}. {t.nome}</div>
                <div>{t.quantidade.toFixed(1)} {t.unidade}</div>
                <div>{t.vezes}x</div>
              </div>
            ))}
            {top.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Sem dados no período</div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
