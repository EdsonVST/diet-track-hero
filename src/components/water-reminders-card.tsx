import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_HORARIOS,
  isStandalone,
  sendTestReminder,
  syncSchedule,
  useNotificationPermission,
  type WaterReminders,
} from "@/lib/water-reminders";

export function WaterRemindersCard() {
  const qc = useQueryClient();
  const { permission, request } = useNotificationPermission();
  const [standalone, setStandalone] = useState(true);
  useEffect(() => setStandalone(isStandalone()), []);

  const remindersQ = useQuery({
    queryKey: ["water_reminders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("water_reminders").select("*").maybeSingle();
      if (error) throw error;
      return data as WaterReminders | null;
    },
  });

  const [ativo, setAtivo] = useState(false);
  const [horarios, setHorarios] = useState<string[]>(DEFAULT_HORARIOS);
  const [novo, setNovo] = useState("09:00");

  useEffect(() => {
    if (remindersQ.data) {
      setAtivo(remindersQ.data.ativo);
      setHorarios([...(remindersQ.data.horarios ?? [])].sort());
    }
  }, [remindersQ.data]);

  const save = useMutation({
    mutationFn: async (payload: { ativo: boolean; horarios: string[] }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("water_reminders")
        .upsert({ user_id: u.user.id, ativo: payload.ativo, horarios: payload.horarios });
      if (error) throw error;
      // Cancela os agendamentos antigos e cria os novos no service worker.
      await syncSchedule(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water_reminders"] });
      toast.success("Lembretes salvos e agendados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = async (value: boolean) => {
    if (value && permission !== "granted") {
      const result = await request();
      if (result !== "granted") {
        toast.error("Permissão de notificação negada pelo dispositivo");
        return;
      }
    }
    setAtivo(value);
    save.mutate({ ativo: value, horarios });
  };

  const addHorario = () => {
    if (!/^\d{2}:\d{2}$/.test(novo)) return toast.error("Horário inválido");
    if (horarios.includes(novo)) return toast.error("Horário já cadastrado");
    const next = [...horarios, novo].sort();
    setHorarios(next);
    save.mutate({ ativo, horarios: next });
  };

  const editHorario = (index: number, value: string) => {
    const next = horarios.map((h, i) => (i === index ? value : h));
    setHorarios(next);
  };

  const commitEdit = () => {
    const next = [...horarios].sort();
    setHorarios(next);
    save.mutate({ ativo, horarios: next });
  };

  const removeHorario = (index: number) => {
    const next = horarios.filter((_, i) => i !== index);
    setHorarios(next);
    save.mutate({ ativo, horarios: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {ativo ? <Bell className="h-4 w-4 text-sky-500" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
          Lembretes de Água
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Ativar lembretes</div>
            <div className="text-xs text-muted-foreground">Notificações locais nos horários configurados</div>
          </div>
          <Switch checked={ativo} onCheckedChange={toggle} />
        </div>

        {permission === "unsupported" && (
          <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            Este dispositivo/navegador não oferece suporte a notificações locais.
          </div>
        )}
        {permission === "denied" && (
          <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              As notificações estão <strong>bloqueadas</strong> neste aparelho. Para ativar: abra as configurações do navegador →
              <em> Configurações do site / Notificações</em> → permita para este site. No Android também verifique
              <em> Configurações → Apps → NutriControl → Notificações</em>. No iPhone, adicione o app à Tela de Início e permita
              notificações quando solicitado.
            </span>
          </div>
        )}
        {ativo && permission === "granted" && !standalone && (
          <div className="flex gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-xs">
            <TriangleAlert className="h-4 w-4 shrink-0 text-sky-600" />
            Para receber lembretes com o app fechado ou com a tela bloqueada, instale o NutriControl na tela inicial
            (menu do navegador → “Adicionar à tela de início” / “Instalar app”).
          </div>
        )}


        <div className="space-y-2">
          <Label className="text-xs">Horários</Label>
          {horarios.length === 0 && <div className="text-xs text-muted-foreground">Nenhum horário configurado.</div>}
          <div className="grid gap-2 sm:grid-cols-2">
            {horarios.map((h, i) => (
              <div key={`${h}-${i}`} className="flex items-center gap-2">
                <Input type="time" value={h} onChange={(e) => editHorario(i, e.target.value)} onBlur={commitEdit} />
                <Button variant="ghost" size="icon" onClick={() => removeHorario(i)} title="Remover">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Input type="time" value={novo} onChange={(e) => setNovo(e.target.value)} className="max-w-[150px]" />
            <Button variant="outline" onClick={addHorario}><Plus className="h-4 w-4 mr-1" />Adicionar horário</Button>
            {permission === "granted" && (
              <Button variant="ghost" size="sm" onClick={() => sendTestReminder()}>Testar</Button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Ao tocar na notificação, o app abre direto na tela de Hidratação. Em celulares, instale o app na tela inicial para receber
          lembretes com o app em segundo plano — se o sistema encerrar o app, os lembretes voltam assim que ele for reaberto.
        </p>
      </CardContent>
    </Card>
  );
}
