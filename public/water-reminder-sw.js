/* Service worker dedicado a lembretes de água (notificações locais agendadas).
   Não faz cache de assets nem intercepta navegações. */

const CONFIG_CACHE = "water-reminder-config-v1";
const CONFIG_URL = "/__water-reminder-config";
const NOTIF_TAG_PREFIX = "water-reminder";
const TITLE = "💧 Hora de beber água!";
const BODY = "Mantenha sua hidratação em dia.";

let timers = [];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await reschedule();
    })(),
  ),
);

async function saveConfig(config) {
  const cache = await caches.open(CONFIG_CACHE);
  await cache.put(CONFIG_URL, new Response(JSON.stringify(config)));
}

async function loadConfig() {
  try {
    const cache = await caches.open(CONFIG_CACHE);
    const res = await cache.match(CONFIG_URL);
    if (!res) return { ativo: false, horarios: [] };
    return await res.json();
  } catch {
    return { ativo: false, horarios: [] };
  }
}

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

function nextOccurrence(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

async function notify(horario) {
  if (self.Notification && self.Notification.permission !== "granted") return;
  await self.registration.showNotification(TITLE, {
    body: BODY,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `${NOTIF_TAG_PREFIX}-${horario}`,
    renotify: true,
    data: { url: "/hidratacao" },
  });
}

/** (Re)agenda todos os horários. Cancela agendamentos antigos antes. */
async function reschedule() {
  clearTimers();
  const { ativo, horarios } = await loadConfig();
  if (!ativo || !Array.isArray(horarios)) return;

  for (const horario of horarios) {
    if (!/^\d{2}:\d{2}/.test(horario)) continue;
    const hhmm = horario.slice(0, 5);
    const delay = nextOccurrence(hhmm).getTime() - Date.now();
    // setTimeout dentro do SW é limitado ao tempo de vida do worker; o
    // periodicsync/sync e o cliente reagendam sempre que o SW acorda.
    timers.push(
      setTimeout(() => {
        void notify(hhmm).then(() => reschedule());
      }, Math.max(1000, delay)),
    );
  }
}

/** Dispara horários que já passaram nos últimos minutos e ainda não notificaram. */
async function fireDueReminders() {
  const { ativo, horarios } = await loadConfig();
  if (!ativo || !Array.isArray(horarios)) return;
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  for (const horario of horarios) {
    const [h, m] = String(horario).slice(0, 5).split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    const diff = minutesNow - (h * 60 + m);
    if (diff >= 0 && diff <= 15) await notify(String(horario).slice(0, 5));
  }
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "set-schedule") {
    event.waitUntil(saveConfig({ ativo: !!msg.ativo, horarios: msg.horarios ?? [] }).then(reschedule));
  } else if (msg.type === "check-now") {
    event.waitUntil(fireDueReminders().then(reschedule));
  } else if (msg.type === "test") {
    event.waitUntil(notify("teste"));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "water-reminders") event.waitUntil(fireDueReminders().then(reschedule));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "water-reminders") event.waitUntil(fireDueReminders().then(reschedule));
});

self.addEventListener("push", (event) => {
  event.waitUntil(notify("push"));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL("/hidratacao", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
