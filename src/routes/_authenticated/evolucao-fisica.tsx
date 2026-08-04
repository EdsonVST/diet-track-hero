import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Camera, TrendingDown, Target } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/evolucao-fisica")({
  component: EvolucaoFisicaPage,
});

type Photo = {
  id: string; user_id: string; data: string; categoria: string;
  storage_path: string; peso_kg: number | null; observacoes: string | null;
};

const CATS = [
  { value: "frente", label: "Frente" },
  { value: "lado", label: "Lado" },
  { value: "costas", label: "Costas" },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function EvolucaoFisicaPage() {
  const qc = useQueryClient();
  const [compareLeft, setCompareLeft] = useState<string>("");
  const [compareRight, setCompareRight] = useState<string>("");

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").maybeSingle();
      return data;
    },
  });

  const photosQ = useQuery({
    queryKey: ["progress_photos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("progress_photos").select("*").order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
  });

  const remove = useMutation({
    mutationFn: async (p: Photo) => {
      await supabase.storage.from("progress-photos").remove([p.storage_path]);
      const { error } = await supabase.from("progress_photos").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["progress_photos"] }); toast.success("Foto removida"); },
  });

  const photos = photosQ.data ?? [];
  const dates = Array.from(new Set(photos.map((p) => p.data))).sort().reverse();
  const altura = profileQ.data?.altura ?? null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Evolução Física</h1>
        <p className="text-sm text-muted-foreground">Acompanhe sua evolução com fotos categorizadas</p>
      </div>

      <WeightChartCard
        photos={photos}
        pesoAtualPerfil={profileQ.data?.peso ?? null}
        pesoMeta={profileQ.data?.peso_meta ?? null}
      />

      <UploadCard onUploaded={() => qc.invalidateQueries({ queryKey: ["progress_photos"] })} />


      {dates.length >= 2 && (
        <Card>
          <CardHeader><CardTitle>Comparar datas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Select value={compareLeft} onValueChange={setCompareLeft}>
                <SelectTrigger><SelectValue placeholder="Data inicial" /></SelectTrigger>
                <SelectContent>{dates.map((d) => <SelectItem key={d} value={d}>{new Date(d).toLocaleDateString("pt-BR")}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={compareRight} onValueChange={setCompareRight}>
                <SelectTrigger><SelectValue placeholder="Data final" /></SelectTrigger>
                <SelectContent>{dates.map((d) => <SelectItem key={d} value={d}>{new Date(d).toLocaleDateString("pt-BR")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {compareLeft && compareRight && (
              <div className="grid grid-cols-3 gap-3">
                {CATS.map((c) => (
                  <div key={c.value} className="space-y-2">
                    <div className="text-xs font-semibold text-center">{c.label}</div>
                    <div className="grid grid-cols-2 gap-1">
                      <ComparePhoto photo={photos.find((p) => p.data === compareLeft && p.categoria === c.value)} altura={altura} />
                      <ComparePhoto photo={photos.find((p) => p.data === compareRight && p.categoria === c.value)} altura={altura} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="font-bold text-lg">Timeline</h2>
        {dates.map((d) => (
          <Card key={d}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{new Date(d).toLocaleDateString("pt-BR", { dateStyle: "long" })}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {CATS.map((c) => {
                  const ph = photos.find((p) => p.data === d && p.categoria === c.value);
                  return (
                    <div key={c.value} className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
                      {ph ? (
                        <div className="space-y-1">
                          <SignedImage path={ph.storage_path} />
                          {ph.peso_kg && (
                            <div className="text-xs">
                              {ph.peso_kg}kg
                              {altura && ph.peso_kg && <> · IMC {(ph.peso_kg / Math.pow(altura / 100, 2)).toFixed(1)}</>}
                            </div>
                          )}
                          {ph.observacoes && <div className="text-xs text-muted-foreground">{ph.observacoes}</div>}
                          <Button variant="ghost" size="sm" className="w-full h-7" onClick={() => remove.mutate(ph)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <div className="aspect-square rounded-md bg-muted grid place-items-center text-xs text-muted-foreground">—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
        {dates.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">Faça seu primeiro upload acima.</div>}
      </div>
    </div>
  );
}

function ComparePhoto({ photo, altura }: { photo: Photo | undefined; altura: number | null }) {
  if (!photo) return <div className="aspect-square rounded-md bg-muted grid place-items-center text-xs text-muted-foreground">—</div>;
  return (
    <div className="space-y-1">
      <SignedImage path={photo.storage_path} />
      <div className="text-xs text-center">
        {new Date(photo.data).toLocaleDateString("pt-BR")}
        {photo.peso_kg && <> · {photo.peso_kg}kg</>}
        {altura && photo.peso_kg && <> · IMC {(photo.peso_kg / Math.pow(altura / 100, 2)).toFixed(1)}</>}
      </div>
    </div>
  );
}

function SignedImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.storage.from("progress-photos").createSignedUrl(path, 3600).then(({ data }) => {
      if (active && data) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);
  if (!url) return <div className="aspect-square rounded-md bg-muted animate-pulse" />;
  return <img src={url} alt="" className="aspect-square w-full object-cover rounded-md" />;
}

function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const [data, setData] = useState(todayISO());
  const [categoria, setCategoria] = useState("frente");
  const [peso, setPeso] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handle = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("progress-photos").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("progress_photos").insert({
        user_id: u.user.id, data, categoria, storage_path: path,
        peso_kg: peso ? Number(peso) : null, observacoes: obs || null,
      });
      if (insErr) throw insErr;
      toast.success("Foto enviada");
      setFile(null); setPeso(""); setObs("");
      onUploaded();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" />Nova foto</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-5">
        <div><Label className="text-xs">Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
        <div>
          <Label className="text-xs">Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Peso (kg)</Label><Input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} /></div>
        <div className="md:col-span-2"><Label className="text-xs">Observações</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <div className="md:col-span-4"><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <Button onClick={handle} disabled={uploading}><Upload className="h-4 w-4 mr-1" />{uploading ? "Enviando..." : "Enviar"}</Button>
      </CardContent>
    </Card>
  );
}

function WeightChartCard({
  photos,
  pesoAtualPerfil,
  pesoMeta,
}: {
  photos: Photo[];
  pesoAtualPerfil: number | null;
  pesoMeta: number | null;
}) {
  // Um ponto por data (mantém o último peso informado no dia), em ordem cronológica.
  const byDate = new Map<string, number>();
  for (const p of [...photos].sort((a, b) => a.data.localeCompare(b.data))) {
    if (p.peso_kg != null) byDate.set(p.data, Number(p.peso_kg));
  }
  const serie = Array.from(byDate.entries()).map(([data, peso]) => ({
    data,
    label: new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    peso,
  }));

  const primeiro = serie[0]?.peso ?? null;
  const atual = serie.length > 0 ? serie[serie.length - 1].peso : pesoAtualPerfil;
  const variacao = primeiro != null && atual != null ? atual - primeiro : null;
  const restam = atual != null && pesoMeta != null ? atual - pesoMeta : null;

  let progresso: number | null = null;
  if (primeiro != null && atual != null && pesoMeta != null && primeiro !== pesoMeta) {
    progresso = Math.max(0, Math.min(100, ((primeiro - atual) / (primeiro - pesoMeta)) * 100));
  }

  const valores = [...serie.map((s) => s.peso), ...(pesoMeta != null ? [pesoMeta] : [])];
  const min = valores.length ? Math.floor(Math.min(...valores) - 2) : 0;
  const max = valores.length ? Math.ceil(Math.max(...valores) + 2) : 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-primary" />
          Evolução do peso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {serie.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Informe o peso ao enviar suas fotos para acompanhar a evolução aqui.
          </div>
        ) : (
          <div className="h-56 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <YAxis domain={[min, max]} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" unit="kg" width={54} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }}
                  formatter={(v: number | string) => [`${v} kg`, "Peso"]}
                />
                {pesoMeta != null && (
                  <ReferenceLine
                    y={pesoMeta}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="6 4"
                    label={{ value: `Meta ${pesoMeta} kg`, position: "insideTopRight", fontSize: 11, fill: "hsl(var(--primary))" }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="peso"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Peso atual" value={atual != null ? `${atual} kg` : "—"} />
          <Stat label="Meta" value={pesoMeta != null ? `${pesoMeta} kg` : "definir no Perfil"} />
          <Stat
            label={restam != null && restam < 0 ? "Acima da meta" : "Restam"}
            value={restam != null ? `${Math.abs(restam).toFixed(1)} kg` : "—"}
          />
          <Stat
            label={variacao != null && variacao > 0 ? "Ganho" : "Perdido"}
            value={variacao != null ? `${Math.abs(variacao).toFixed(1)} kg` : "—"}
          />
        </div>

        {progresso != null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground"><Target className="h-3 w-3" />Progresso até a meta</span>
              <span className="font-semibold">{progresso.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        )}
        {pesoMeta == null && (
          <p className="text-[11px] text-muted-foreground">
            Defina seu <strong>Peso meta (kg)</strong> no Perfil para ver a linha da meta e o percentual de progresso.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}
