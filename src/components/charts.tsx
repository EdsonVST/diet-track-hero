import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS: Record<string, string> = {
  calorias: "var(--primary)",
  proteina: "var(--protein)",
  carboidrato: "var(--carbs)",
  gordura: "var(--fat)",
  fibra: "var(--fiber)",
  agua: "var(--chart-2)",
};

export function fmtDayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function TrendTooltip({
  active,
  payload,
  label,
  unidade,
  nome,
}: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const delta = p.__delta as number | null | undefined;
  return (
    <div className="rounded-xl border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="text-[11px] font-medium text-muted-foreground">{p.__dateLong ?? label}</div>
      <div className="text-base font-bold tabular-nums">
        {payload[0].value?.toLocaleString("pt-BR")} <span className="text-xs font-medium text-muted-foreground">{unidade}</span>
      </div>
      {delta != null && (
        <div className={`text-[11px] font-semibold ${delta > 0 ? "text-destructive" : delta < 0 ? "text-primary" : "text-muted-foreground"}`}>
          {delta > 0 ? "+" : ""}
          {delta.toLocaleString("pt-BR")} {unidade} desde o registro anterior
        </div>
      )}
      {nome && <div className="text-[10px] text-muted-foreground">{nome}</div>}
    </div>
  );
}

type TrendPoint = { label: string; value: number; __delta?: number | null; __dateLong?: string };

export function TrendAreaChart({
  data,
  color,
  unidade,
  nome,
  domain,
  height = "100%",
  showAvg,
}: {
  data: TrendPoint[];
  color: string;
  unidade: string;
  nome?: string;
  domain?: [number | "auto", number | "auto"];
  height?: number | string;
  showAvg?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const last = data[data.length - 1];
  const avg = showAvg && data.length ? data.reduce((s, d) => s + d.value, 0) / data.length : null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          domain={domain ?? ["auto", "auto"]}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<TrendTooltip unidade={unidade} nome={nome} />} cursor={{ stroke: color, strokeDasharray: "3 3" }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#g-${id})`}
          dot={{ r: 2.5, fill: "var(--card)", stroke: color, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
          animationDuration={900}
          animationEasing="ease-out"
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HorizontalRankBar({
  data,
  unidade,
}: {
  data: Array<{ nome: string; value: number; extra?: string }>;
  unidade: string;
}) {
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 6" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="nome"
          width={120}
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={({ active, payload }: any) =>
            active && payload?.length ? (
              <div className="rounded-xl border bg-popover/95 px-3 py-2 shadow-lg text-xs">
                <div className="font-semibold">{payload[0].payload.nome}</div>
                <div className="tabular-nums">
                  {payload[0].value.toLocaleString("pt-BR")} {unidade}
                </div>
                {payload[0].payload.extra && <div className="text-muted-foreground">{payload[0].payload.extra}</div>}
              </div>
            ) : null
          }
        />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={800} barSize={16}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
