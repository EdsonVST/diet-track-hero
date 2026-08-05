import { computeNutrients, sumTotals, emptyTotals, MEAL_LABELS, VITAMIN_KEYS, MINERAL_KEYS, VITAMIN_LABELS, MINERAL_LABELS, MICRO_UNITS, type ComputedNutrients } from "./nutrition";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type MealRow = {
  id: string;
  data: string;
  tipo: string;
  horario: string | null;
  meal_foods: Array<{
    id: string;
    quantidade: number;
    foods: any;
  }> | null;
};

export type ReportRow = {
  data: string;
  refeicao: string;
  alimento: string;
  quantidade: number;
  unidade: string;
  nut: ComputedNutrients;
};

export function buildRows(meals: MealRow[]): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const m of meals) {
    for (const mf of m.meal_foods ?? []) {
      if (!mf.foods) continue;
      const nut = computeNutrients(mf.foods, Number(mf.quantidade));
      rows.push({
        data: m.data,
        refeicao: MEAL_LABELS[m.tipo] ?? m.tipo,
        alimento: mf.foods.nome,
        quantidade: Number(mf.quantidade),
        unidade: mf.foods.unidade_base,
        nut,
      });
    }
  }
  return rows;
}

export function totalsByDay(rows: ReportRow[]) {
  const map = new Map<string, ComputedNutrients>();
  for (const r of rows) {
    map.set(r.data, sumTotals(map.get(r.data) ?? emptyTotals(), r.nut));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, t]) => ({ data, ...t }));
}

export function totalsByMeal(rows: ReportRow[]) {
  const map = new Map<string, { tipo: string; count: number; totals: ComputedNutrients }>();
  for (const r of rows) {
    const prev = map.get(r.refeicao) ?? { tipo: r.refeicao, count: 0, totals: emptyTotals() };
    map.set(r.refeicao, { tipo: r.refeicao, count: prev.count + 1, totals: sumTotals(prev.totals, r.nut) });
  }
  return Array.from(map.values());
}

/** Média por refeição considerando somente os dias em que a refeição foi registrada. */
export function averagesByMeal(rows: ReportRow[]) {
  const map = new Map<string, { tipo: string; itens: number; dias: Set<string>; totals: ComputedNutrients }>();
  for (const r of rows) {
    const prev = map.get(r.refeicao) ?? { tipo: r.refeicao, itens: 0, dias: new Set<string>(), totals: emptyTotals() };
    prev.itens += 1;
    prev.dias.add(r.data);
    prev.totals = sumTotals(prev.totals, r.nut);
    map.set(r.refeicao, prev);
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return Array.from(map.values())
    .map((m) => {
      const d = Math.max(1, m.dias.size);
      return {
        tipo: m.tipo,
        dias: m.dias.size,
        itens: m.itens,
        itensPorDia: round1(m.itens / d),
        calorias: round1(m.totals.calorias / d),
        proteina: round1(m.totals.proteina / d),
        carboidrato: round1(m.totals.carboidrato / d),
        gordura: round1(m.totals.gordura / d),
        fibra: round1(m.totals.fibra / d),
      };
    })
    .sort((a, b) => b.calorias - a.calorias);
}

export function totalsOverall(rows: ReportRow[]): ComputedNutrients {
  return rows.reduce((acc, r) => sumTotals(acc, r.nut), emptyTotals());
}

/** Ranking de alimentos com média diária consumida (dias do período com algum registro). */
export function topFoods(rows: ReportRow[], n = 10) {
  const diasComRegistro = new Set(rows.map((r) => r.data)).size || 1;
  const map = new Map<string, { nome: string; quantidade: number; vezes: number; unidade: string; kcal: number }>();
  for (const r of rows) {
    const prev = map.get(r.alimento) ?? { nome: r.alimento, quantidade: 0, vezes: 0, unidade: r.unidade, kcal: 0 };
    map.set(r.alimento, {
      ...prev,
      quantidade: prev.quantidade + r.quantidade,
      vezes: prev.vezes + 1,
      kcal: prev.kcal + r.nut.calorias,
    });
  }
  const all = Array.from(map.values());
  const kcalTotal = all.reduce((s, f) => s + f.kcal, 0) || 1;
  return all
    .map((f) => ({
      ...f,
      mediaDiaria: Math.round((f.quantidade / diasComRegistro) * 10) / 10,
      kcalDia: Math.round(f.kcal / diasComRegistro),
      participacao: Math.round((f.kcal / kcalTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.kcalDia - a.kcalDia || b.vezes - a.vezes)
    .slice(0, n);
}


const EXPORT_HEADERS = [
  "Data","Refeição","Alimento","Quantidade","Unidade","Calorias (kcal)","Proteínas (g)","Carboidratos (g)","Gorduras (g)","Fibras (g)",
  ...VITAMIN_KEYS.map((k) => `${VITAMIN_LABELS[k]} (${MICRO_UNITS[k]})`),
  ...MINERAL_KEYS.map((k) => `${MINERAL_LABELS[k]} (${MICRO_UNITS[k]})`),
];

function toMatrix(rows: ReportRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.data, r.refeicao, r.alimento, r.quantidade, r.unidade,
    r.nut.calorias, r.nut.proteina, r.nut.carboidrato, r.nut.gordura, r.nut.fibra,
    ...VITAMIN_KEYS.map((k) => (r.nut as any)[k] ?? 0),
    ...MINERAL_KEYS.map((k) => (r.nut as any)[k] ?? 0),
  ]);
}

export function exportCSV(rows: ReportRow[], filename: string) {
  const lines = [EXPORT_HEADERS, ...toMatrix(rows)]
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[;",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8;" });
  download(blob, filename + ".csv");
}

export function exportXLSX(rows: ReportRow[], filename: string, meta: { nome: string; periodo: string; geradoEm: string }) {
  const wb = XLSX.utils.book_new();
  const capa = [
    ["NutriControl — Relatório Nutricional"],
    [],
    ["Usuário", meta.nome],
    ["Período", meta.periodo],
    ["Gerado em", meta.geradoEm],
    ["Total de registros", rows.length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(capa), "Capa");
  const data = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...toMatrix(rows)]);
  XLSX.utils.book_append_sheet(wb, data, "Detalhado");
  XLSX.writeFile(wb, filename + ".xlsx");
}

export function exportPDF(rows: ReportRow[], filename: string, meta: { nome: string; periodo: string; geradoEm: string }, totals: ComputedNutrients) {
  const doc = new jsPDF({ orientation: "landscape" });
  // Capa
  doc.setFontSize(22); doc.text("NutriControl", 14, 22);
  doc.setFontSize(14); doc.text("Relatório Nutricional", 14, 32);
  doc.setFontSize(11);
  doc.text(`Usuário: ${meta.nome}`, 14, 46);
  doc.text(`Período: ${meta.periodo}`, 14, 54);
  doc.text(`Gerado em: ${meta.geradoEm}`, 14, 62);
  doc.text("Resumo", 14, 76);
  autoTable(doc, {
    startY: 80,
    head: [["Calorias","Proteínas","Carboidratos","Gorduras","Fibras"]],
    body: [[
      `${totals.calorias} kcal`,
      `${totals.proteina} g`,
      `${totals.carboidrato} g`,
      `${totals.gordura} g`,
      `${totals.fibra} g`,
    ]],
    theme: "striped",
  });
  doc.addPage();
  autoTable(doc, {
    head: [["Data","Refeição","Alimento","Qtd","Un","Kcal","P","C","G","Fibra"]],
    body: rows.map((r) => [r.data, r.refeicao, r.alimento, r.quantidade, r.unidade, r.nut.calorias, r.nut.proteina, r.nut.carboidrato, r.nut.gordura, r.nut.fibra]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [34, 139, 87] },
  });
  doc.save(filename + ".pdf");
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
