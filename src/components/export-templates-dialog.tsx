import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Tpl = { id: string; nome: string; descricao: string | null; objetivo: string | null };

type Row = {
  ordem: number;
  series: number;
  repeticoes: string;
  descanso_segundos: number;
  observacoes: string | null;
  exercises: {
    nome: string;
    grupo_muscular: string | null;
    equipamento: string | null;
    descricao: string | null;
  } | null;
};

export function ExportTemplatesDialog({ templates }: { templates: Tpl[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const exercisesQ = useQuery({
    queryKey: ["template-exercises-export", selected],
    enabled: open && selected.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_exercises")
        .select(
          "template_id, ordem, series, repeticoes, descanso_segundos, observacoes, exercises(nome, grupo_muscular, equipamento, descricao)",
        )
        .in("template_id", selected)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as Array<Row & { template_id: string }>;
    },
  });

  const generate = async () => {
    if (selected.length === 0) return toast.error("Selecione ao menos um modelo");
    setBusy(true);
    try {
      const rows = exercisesQ.data ?? (await exercisesQ.refetch()).data ?? [];
      const doc = new jsPDF({ format: "a4", unit: "mm" });
      const hoje = new Date().toLocaleDateString("pt-BR");
      const chosen = templates.filter((t) => selected.includes(t.id));

      chosen.forEach((t, idx) => {
        if (idx > 0) doc.addPage();
        doc.setFillColor(16, 122, 87);
        doc.rect(0, 0, 210, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("NutriControl — Modelo de Treino", 14, 11);
        doc.setFontSize(10);
        doc.text(`Exportado em ${hoje}`, 14, 18);

        doc.setTextColor(20, 20, 20);
        doc.setFontSize(18);
        doc.text(t.nome, 14, 36);
        doc.setFontSize(10);
        doc.setTextColor(90, 90, 90);
        let y = 42;
        if (t.objetivo) {
          doc.text(`Objetivo: ${t.objetivo}`, 14, y);
          y += 5;
        }
        if (t.descricao) {
          doc.text(doc.splitTextToSize(t.descricao, 182) as string[], 14, y);
          y += 5 * (doc.splitTextToSize(t.descricao, 182) as string[]).length;
        }

        const body = rows
          .filter((r) => r.template_id === t.id)
          .sort((a, b) => a.ordem - b.ordem)
          .map((r, i) => [
            String(i + 1),
            r.exercises?.nome ?? "—",
            r.exercises?.grupo_muscular ?? "—",
            r.exercises?.equipamento ?? "—",
            `${r.series}x${r.repeticoes}`,
            `${r.descanso_segundos}s`,
            r.exercises?.descricao ?? r.observacoes ?? "",
          ]);

        autoTable(doc, {
          startY: y + 4,
          head: [["#", "Exercício", "Grupo", "Equipamento", "Séries x Reps", "Descanso", "Descrição"]],
          body: body.length > 0 ? body : [["—", "Nenhum exercício cadastrado", "", "", "", "", ""]],
          styles: { fontSize: 9, cellPadding: 2, valign: "top" },
          headStyles: { fillColor: [16, 122, 87], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 248, 246] },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 38 },
            2: { cellWidth: 26 },
            3: { cellWidth: 26 },
            4: { cellWidth: 22 },
            5: { cellWidth: 16 },
            6: { cellWidth: 46 },
          },
          margin: { left: 14, right: 14 },
        });

        const after = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setTextColor(20, 20, 20);
        doc.text("Anotações", 14, after);
        doc.setDrawColor(200, 200, 200);
        for (let i = 0; i < 8; i++) {
          const ly = after + 8 + i * 8;
          if (ly > 285) break;
          doc.line(14, ly, 196, ly);
        }
      });

      doc.save(`modelos_treino_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF gerado");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-1" />
          Exportar Modelos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar modelos em PDF</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {templates.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
            >
              <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} />
              <span className="text-sm font-medium">{t.nome}</span>
            </label>
          ))}
          {templates.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={generate} disabled={busy || selected.length === 0}>
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
