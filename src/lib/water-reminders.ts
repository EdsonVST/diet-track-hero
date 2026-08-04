import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WaterReminders = {
  user_id: string;
  ativo: boolean;
  horarios: string[];
};

export const DEFAULT_HORARIOS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

const NOTIF_TITLE = "💧 Hora de beber água!";
const NOTIF_BODY = "Mantenha sua hidratação em dia.";
const SW_URL = "/water-reminder-sw.js";
const FIRED_KEY = "water-reminder-fired";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  if (result === "granted") await registerReminderWorker();
  return result;
}

export async function registerReminderWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg =
      (await navigator.serviceWorker.getRegistration(SW_URL)) ??
      (await navigator.serviceWorker.register(SW_URL, { scope: "/" }));
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

async function activeWorker(): Promise<ServiceWorker | null> {
  const reg = await registerReminderWorker();
  return reg?.active ?? reg?.waiting ?? reg?.installing ?? null;
}

/** Envia os horários para o service worker, que cancela os antigos e reagenda tudo. */
export async function syncSchedule(config: { ativo: boolean; horarios: string[] }) {
  const worker = await activeWorker();
  worker?.postMessage({ type: "set-schedule", ativo: config.ativo, horarios: config.horarios });
  if (config.ativo) await enablePeriodicSync();
}

/** Pede ao service worker para verificar horários vencidos (quando o app volta ao foco). */
export async function checkScheduleNow() {
  const worker = await activeWorker();
  worker?.postMessage({ type: "check-now" });
}

/** Periodic Background Sync mantém os lembretes vivos com o app fechado (quando suportado). */
async function enablePeriodicSync() {
  try {
    const reg = (await registerReminderWorker()) as
      | (ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> } })
      | null;
    if (!reg?.periodicSync) return;
    const status = await navigator.permissions?.query({ name: "periodic-background-sync" as PermissionName }).catch(() => null);
    if (status && status.state !== "granted") return;
    await reg.periodicSync.register("water-reminders", { minInterval: 15 * 60 * 1000 });
  } catch {
    /* navegador sem suporte — o fallback em app aberto continua funcionando */
  }
}

async function showReminder() {
  if (notificationPermission() !== "granted") return;
  const options: NotificationOptions = {
    body: NOTIF_BODY,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "water-reminder",
  };
  const reg = await registerReminderWorker();
  if (reg) {
    await reg.showNotification(NOTIF_TITLE, options);
  } else {
    new Notification(NOTIF_TITLE, options);
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readFired(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function markFired(horario: string) {
  const day = todayKey();
  const store = readFired();
  const list = store[day] ?? [];
  if (!list.includes(horario)) list.push(horario);
  localStorage.setItem(FIRED_KEY, JSON.stringify({ [day]: list }));
}

function alreadyFired(horario: string) {
  return (readFired()[todayKey()] ?? []).includes(horario);
}

/** Garante que o service worker esteja registrado e com os horários atuais agendados. */
export function useWaterReminderScheduler() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const config = useRef<WaterReminders | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.from("water_reminders").select("*").maybeSingle();
      if (cancelled) return;
      const cfg = (data as WaterReminders | null) ?? null;
      config.current = cfg;
      if (cfg) await syncSchedule({ ativo: cfg.ativo, horarios: cfg.horarios ?? [] });
      await checkScheduleNow();
    };

    void registerReminderWorker().then(() => load());

    const tick = () => {
      const cfg = config.current;
      if (!cfg?.ativo || notificationPermission() !== "granted") return;
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      for (const h of cfg.horarios ?? []) {
        if (h.slice(0, 5) === current && !alreadyFired(h)) {
          markFired(h);
          void showReminder();
        }
      }
    };

    timer.current = setInterval(tick, 20_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setPermission(notificationPermission()), []);
  return {
    permission,
    request: async () => {
      const p = await requestNotificationPermission();
      setPermission(p);
      return p;
    },
  };
}

export async function sendTestReminder() {
  await showReminder();
}

/** true quando o app está rodando instalado (standalone), onde as notificações são mais confiáveis. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
