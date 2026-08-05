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
import { FileDown, FileSpreadsheet, FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TrendAreaChart, HorizontalRankBar, CHART_COLORS, fmtDayLabel } from "@/components/charts";
import { buildRows, totalsByDay, averagesByMeal, totalsOverall, topFoods, exportCSV, exportXLSX, exportPDF, type MealRow } from "@/lib/reports";


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

  const waterQ = useQuery({
    queryKey: ["report-water", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("water_logs")
        .select("data,quantidade_ml")
        .gte("data", range.from)
        .lte("data", range.to);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => buildRows(mealsQ.data ?? []), [mealsQ.data]);
  const byDay = useMemo(() => totalsByDay(rows), [rows]);
  const byMeal = useMemo(() => averagesByMeal(rows), [rows]);
  const top = useMemo(() => topFoods(rows), [rows]);
  const overall = useMemo(() => totalsOverall(rows), [rows]);
  const dias = byDay.length || 1;

  const series = useMemo(() => {
    const build = (key: "calorias" | "proteina" | "carboidrato" | "gordura" | "fibra") =>
      byDay.map((d: any, i: number) => ({
        label: fmtDayLabel(d.data),
        value: Number(d[key] ?? 0),
        __dateLong: new Date(`${d.data}T00:00:00`).toLocaleDateString("pt-BR", { dateStyle: "long" }),
        __delta: i === 0 ? null : Math.round((Number(d[key]) - Number((byDay[i - 1] as any)[key])) * 10) / 10,
      }));
    return {
      calorias: build("calorias"),
      proteina: build("proteina"),
      carboidrato: build("carboidrato"),
      gordura: build("gordura"),
      fibra: build("fibra"),
    };
  }, [byDay]);

  const waterSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of waterQ.data ?? []) map.set(w.data, (map.get(w.data) ?? 0) + Number(w.quantidade_ml));
    const arr = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return arr.map(([d, ml], i) => ({
      label: fmtDayLabel(d),
      value: ml,
      __dateLong: new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR", { dateStyle: "long" }),
      __delta: i === 0 ? null : ml - arr[i - 1][1],
    }));
  }, [waterQ.data]);


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
          { l: "Calorias", v: overall.calorias, u: "kcal", k: "calorias" },
          { l: "Proteínas", v: overall.proteina, u: "g", k: "proteina" },
          { l: "Carboidratos", v: overall.carboidrato, u: "g", k: "carboidrato" },
          { l: "Gorduras", v: overall.gordura, u: "g", k: "gordura" },
          { l: "Fibras", v: overall.fibra, u: "g", k: "fibra" },
        ].map((s) => {
          const media = Math.round((s.v / dias) * 10) / 10;
          const serie = (series as any)[s.k] as Array<{ value: number }>;
          const trend =
            serie.length >= 2 ? serie[serie.length - 1].value - serie[serie.length - 2].value : 0;
          const Icon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
          return (
            <Card key={s.l} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground truncate">{s.l}</div>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: CHART_COLORS[s.k] }}
                  />
                </div>
                <div className="text-xl font-bold mt-1 tabular-nums">
                  {media.toLocaleString("pt-BR")}{" "}
                  <span className="text-xs font-medium text-muted-foreground">{s.u}/dia</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">total {s.v.toLocaleString("pt-BR")} {s.u}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="graficos">
        <TabsList>
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
          <TabsTrigger value="refeicoes">Por refeição</TabsTrigger>
          <TabsTrigger value="alimentos">Mais consumidos</TabsTrigger>
        </TabsList>

        <TabsContent value="graficos" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {([
              ["calorias", "Calorias por dia", "kcal"],
              ["proteina", "Proteínas por dia", "g"],
              ["carboidrato", "Carboidratos por dia", "g"],
              ["gordura", "Gorduras por dia", "g"],
              ["fibra", "Fibras por dia", "g"],
            ] as const).map(([k, titulo, unidade]) => {
              const serie = (series as any)[k] as Array<{ value: number }>;
              const media = serie.length ? serie.reduce((s, d) => s + d.value, 0) / serie.length : 0;
              return (
                <Card key={k} className="overflow-hidden">
                  <CardHeader className="pb-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <CardTitle className="truncate text-base">{titulo}</CardTitle>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                        média {Math.round(media * 10) / 10} {unidade}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="h-56 sm:h-64 px-2">
                    {serie.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <TrendAreaChart data={serie as any} color={CHART_COLORS[k]} unidade={unidade} />
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Card className="overflow-hidden">
              <CardHeader className="pb-1">
                <CardTitle className="text-base">Água consumida por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-56 sm:h-64 px-2">
                {waterSeries.length === 0 ? <EmptyChart /> : (
                  <TrendAreaChart data={waterSeries as any} color={CHART_COLORS.agua} unidade="ml" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="refeicoes" className="space-y-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Média por refeição</CardTitle>
              <p className="text-xs text-muted-foreground">
                Considera apenas os dias em que cada refeição foi registrada.
              </p>
            </CardHeader>
            <CardContent className="h-64 px-2">
              {byMeal.length === 0 ? <EmptyChart /> : (
                <HorizontalRankBar
                  unidade="kcal/refeição"
                  data={byMeal.map((m) => ({
                    nome: m.tipo,
                    value: m.calorias,
                    extra: `${m.proteina}g P · ${m.carboidrato}g C · ${m.gordura}g G · ${m.dias} dia(s)`,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {byMeal.map((m) => (
              <Card key={m.tipo}>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <div className="truncate font-semibold">{m.tipo}</div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{m.dias} dia(s) registrados</span>
                  </div>
                  <div className="text-2xl font-black tabular-nums">
                    {m.calorias.toLocaleString("pt-BR")}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">kcal em média</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      ["Proteína", m.proteina, "proteina"],
                      ["Carbo", m.carboidrato, "carboidrato"],
                      ["Gordura", m.gordura, "gordura"],
                      ["Fibra", m.fibra, "fibra"],
                    ].map(([l, v, key]) => (
                      <div key={l as string} className="rounded-lg border p-2">
                        <div className="text-[10px] text-muted-foreground">{l as string}</div>
                        <div
                          className="text-sm font-bold tabular-nums"
                          style={{ color: CHART_COLORS[key as string] }}
                        >
                          {v as number}g
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.itensPorDia} item(ns) por refeição em média
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {byMeal.length === 0 && (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Sem dados no período</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="alimentos" className="space-y-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Alimentos predominantes</CardTitle>
              <p className="text-xs text-muted-foreground">Média diária de calorias vindas de cada alimento</p>
            </CardHeader>
            <CardContent className="px-2">
              {top.length === 0 ? <div className="h-40"><EmptyChart /></div> : (
                <HorizontalRankBar
                  unidade="kcal/dia"
                  data={top.map((t) => ({
                    nome: t.nome,
                    value: t.kcalDia,
                    extra: `${t.mediaDiaria} ${t.unidade}/dia · ${t.participacao}% das calorias`,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card><CardContent className="p-0">
            <div className="grid grid-cols-[1fr_auto_auto] px-4 py-2 text-xs font-medium text-muted-foreground border-b gap-4">
              <div>Alimento</div><div className="text-right">Média diária</div><div className="text-right">Participação</div>
            </div>
            {top.map((t, i) => (
              <div key={t.nome} className="px-4 py-3 border-b last:border-0">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-sm">
                  <div className="min-w-0 truncate font-medium">{i + 1}. {t.nome}</div>
                  <div className="text-right tabular-nums">{t.mediaDiaria} {t.unidade}/dia</div>
                  <div className="w-14 text-right tabular-nums text-muted-foreground">{t.participacao}%</div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, t.participacao)}%`, background: "var(--primary)" }}
                  />
                </div>
              </div>
            ))}
            {top.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Sem dados no período</div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      Sem dados suficientes no período
    </div>
  );
}

