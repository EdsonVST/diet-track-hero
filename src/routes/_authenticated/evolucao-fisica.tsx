import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Camera } from "lucide-react";
import { toast } from "sonner";

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
