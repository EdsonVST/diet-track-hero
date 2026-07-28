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
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    return null;
  }
}

async function showReminder() {
  if (notificationPermission() !== "granted") return;
  const options: NotificationOptions = {
    body: NOTIF_BODY,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "water-reminder",
    requireInteraction: false,
  };
  const reg = (await navigator.serviceWorker?.getRegistration(SW_URL)) ?? (await registerReminderWorker());
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

/** Agenda os lembretes enquanto o app estiver aberto (aba ativa ou em segundo plano). */
export function useWaterReminderScheduler() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const config = useRef<WaterReminders | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.from("water_reminders").select("*").maybeSingle();
      if (!cancelled) config.current = (data as WaterReminders | null) ?? null;
    };

    void load();
    void registerReminderWorker();

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

    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("focus", onFocus);
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
