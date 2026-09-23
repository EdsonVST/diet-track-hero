# NUTRI_Arquiteture

Especificação técnica de engenharia reversa do **NutriControl**.
Objetivo: permitir que outro desenvolvedor (ou outra IA) reconstrua a arquitetura funcional
do aplicativo em um novo projeto, sem acesso ao original.

Convenção de confiabilidade usada em todo o documento:

- **Identificado:** observado diretamente no código/migrations (com referência `arquivo:linha`).
- **Inferência:** conclusão derivada de evidência indireta.
- **Não identificado.** informação que não pôde ser determinada a partir do código.

Base da análise: leitura estática do repositório (rotas, componentes, libs, `supabase/migrations/*`,
`src/integrations/supabase/types.ts`). Não houve execução de testes automatizados.

---

## 1. Visão geral da arquitetura

### 1.1 Objetivo do aplicativo

Sistema web responsivo (PWA) de **controle alimentar e de treino pessoal**. Permite registrar
alimentação diária, acompanhar macro e micronutrientes, hidratação, treinos (modelos, planejamento
semanal, execução e histórico), evolução física por fotos e peso, além de relatórios com exportação.
Inclui um **painel administrativo (Master)** somente leitura para suporte e auditoria.

### 1.2 Stack (Identificado)

| Camada | Tecnologia |
| --- | --- |
| Framework | TanStack Start v1 (React 19, Vite) |
| Roteamento | TanStack Router (file-based, `src/routes`) |
| Estado de servidor | TanStack Query |
| Backend / dados | Supabase (Postgres + RLS + Auth + Storage) |
| Server-side app | `createServerFn` (`src/lib/admin.functions.ts`) — sem Edge Functions |
| UI | Tailwind v4 (tokens semânticos em `src/styles.css`) + shadcn/ui |
| Gráficos | Recharts (`src/components/charts.tsx`) |
| Exportações | `jspdf` + `jspdf-autotable`, `xlsx` (SheetJS) |
| Drag & drop | `@dnd-kit` |
| Notificações UI | `sonner` (`<Toaster richColors position="top-right"/>` em `__root.tsx`) |
| PWA | `public/manifest.webmanifest`, `public/water-reminder-sw.js`, Periodic Background Sync |

### 1.3 Módulos

1. **Infraestrutura/Autenticação** — bootstrap, router, guardas de rota, sessão.
2. **Identidade e escopo de dados** — `useScopedUser`, modo "Visitar usuário".
3. **Nutrição** — Alimentos, Minha Alimentação, Dashboard, Relatórios.
4. **Hidratação** — metas, registros, lembretes via Service Worker.
5. **Treinos** — Exercícios, Modelos, Planejamento Semanal, Treino de Hoje, Histórico.
6. **Corpo/Evolução** — fotos de progresso e gráfico de peso vs. meta.
7. **Administração (Master)** — usuários, visão detalhada, logs de auditoria.

### 1.4 Tipos de usuário e permissões (Identificado)

| Perfil | Origem | Acesso |
| --- | --- | --- |
| Anônimo | sem sessão | apenas `/auth` (e `/` que redireciona) |
| `user` | qualquer conta autenticada | toda a subárvore `/_authenticated/*`, restrita aos **próprios** dados por RLS |
| `master` | linha em `public.user_roles` com `role='master'` | tudo do `user` + `/admin/*` + **SELECT amplo** em todas as tabelas de domínio (policies "Master pode ver ...") + modo "Visitar usuário" |

Regra crítica derivada disso (documentada em `src/lib/scoped-user.ts:1-12`): como o Master tem
leitura ampliada, **nenhuma tela pode confiar apenas no RLS** — toda query pessoal precisa filtrar
explicitamente `user_id` e incluir esse id na `queryKey`.

### 1.5 Fluxo geral de utilização

```text
/ (redirect) → /auth (login/cadastro)
  → trigger handle_new_user cria profiles + nutrition_goals + 3 modelos de treino
  → master?  sim → /admin      não → /dashboard
/dashboard → resumo do dia (macros, metas, água, treino do dia, última foto)
  → /alimentacao, /alimentos, /hidratacao, /relatorios
  → /treino-hoje, /modelos-treino, /planejamento-semanal, /treinos, /historico-treinos
  → /evolucao-fisica, /perfil
/admin → lista de usuários → /admin/usuarios/$userId (leitura) | Visitar usuário | /admin/logs
```

### 1.6 Visão hierárquica

```text
Aplicativo NutriControl
└── Módulo (ex.: Hidratação)
    └── Tela (/hidratacao)
        └── Componente (Card de meta, botões rápidos, BarChart 14 dias)
            └── Ação (clicar "500 ml")
                └── Dados (water_logs: user_id, data, quantidade_ml)
                    └── Regra (quantidade_ml > 0; data = hoje; escrita sempre do usuário autenticado)
                        └── Resultado (insert + invalidate ["water_logs", userId] + toast)
```

### 1.7 Backend vs. frontend

- **Depende de backend (Supabase):** autenticação, todo CRUD de domínio, Storage de fotos
  (URLs assinadas de 1h), RPC `has_role`, `seed_my_default_workout_templates`, e as server functions
  administrativas (`amIMaster`, `listAllUsers`, `getUserOverview`, `setUserAccountStatus`,
  `listAdminLogs`).
- **Só frontend:** cálculo de nutrientes proporcionais (`src/lib/nutrition.ts`), agregações e
  exportações de relatório (`src/lib/reports.ts`), comparação de carga, IMC, progresso de peso,
  filtros, ordenação, deduplicação de lembretes (`localStorage`).
- **Service Worker:** agendamento e disparo das notificações de água (`public/water-reminder-sw.js`).

### 1.8 Estados globais (Identificado)

| Estado | Onde vive | Observações |
| --- | --- | --- |
| Sessão Supabase | `localStorage` via `supabase-js` (`brokeredPreviewStorage`) | `persistSession: true`, `autoRefreshToken: true` |
| Cache de dados | `QueryClient` criado em `src/router.tsx` | `defaultPreloadStaleTime: 0` |
| Usuário em escopo | `useScopedUser()` (query `["auth-user-id"]`, staleTime 5min, gcTime 30min) | fonte única de "de quem são os dados" |
| Modo "Visitar usuário" | `localStorage` chave `nutricontrol.viewAs` | `{id, nome, email}`; ativa banner + `fieldset disabled` |
| Lembretes disparados | `localStorage` (`FIRED_KEY`) + Cache Storage no SW | deduplicação diária |

---

## 2. Ordem de dependência (mapa de leitura)

A documentação segue a ordem real de dependência de dados, não a ordem do menu:

1. Infraestrutura (router, root, clientes Supabase, middlewares)
2. Autenticação (`/auth`) e criação automática de perfil/metas/modelos
3. Escopo de usuário (`scoped-user`, `view-as`)
4. Perfil e metas (`/perfil`)
5. Base de alimentos (`/alimentos`)
6. Refeições (`/alimentacao`)
7. Hidratação (`/hidratacao`) e lembretes
8. Exercícios (`/treinos`)
9. Modelos de treino (`/modelos-treino`)
10. Planejamento semanal (`/planejamento-semanal`)
11. Treino de hoje (`/treino-hoje`)
12. Histórico e progressão de carga (`/historico-treinos`)
13. Evolução física (`/evolucao-fisica`)
14. Dashboard (`/dashboard`)
15. Relatórios (`/relatorios`)
16. Administração (`/admin/*`)

---

## 3. Infraestrutura

### 3.1 Bootstrap — `src/start.ts`

- `errorMiddleware` (request middleware, `start.ts:6-19`): captura exceções; erro com `statusCode`
  é repassado, os demais geram HTML 500 via `renderErrorPage()`.
- `createStart` registra `functionMiddleware: [attachSupabaseAuth]` e
  `requestMiddleware: [errorMiddleware]` (`start.ts:21-24`).
- `attachSupabaseAuth` (`src/integrations/supabase/auth-attacher.ts:7-14`): no cliente, lê
  `supabase.auth.getSession()` e injeta `Authorization: Bearer <access_token>` em **toda** chamada de
  server function. Sem ele, nenhuma server function autenticada recebe o token.

### 3.2 Router — `src/router.tsx:5-15`

`getRouter()` cria um `QueryClient` e o router com `context:{queryClient}`,
`scrollRestoration:true`, `defaultPreloadStaleTime:0` (revalida em cada preload/navegação).

### 3.3 Root route — `src/routes/__root.tsx`

- `createRootRouteWithContext<{queryClient}>()` (`:76`) com `head()` (meta, OG, manifest, favicon,
  theme-color — `:77-107`), `shellComponent` (`:114-126`) e `component` (`:128-138`).
- `notFoundComponent` (`:16-36`): 404 com link para `/`.
- `errorComponent` (`:38-74`): reporta via `reportLovableError(error,{boundary:"tanstack_root_error_component"})`;
  "Try again" chama `router.invalidate()` + `reset()`; "Go home" é `<a href="/">`.
- `RootComponent` provê `QueryClientProvider`, `<Outlet/>` e `<Toaster richColors position="top-right"/>`.

### 3.4 Clientes Supabase

| Entrada | Uso | Auth | RLS |
| --- | --- | --- | --- |
| `@/integrations/supabase/client` | componentes, hooks, mutations | publishable key + sessão do usuário | aplicada |
| `@/integrations/supabase/auth-middleware` (`requireSupabaseAuth`) | server functions autenticadas (`context.supabase`, `context.userId`, `context.claims`) | Bearer JWT da requisição | aplicada como o usuário |
| `@/integrations/supabase/client.server` (`supabaseAdmin`) | operações privilegiadas do painel Master | service role | **ignorada** |

`requireSupabaseAuth` lança `Unauthorized: ...` quando o token está ausente, inválido ou malformado
(`auth-middleware.ts:33-108`).

---

## 4. Autenticação

### 4.1 `/` — `src/routes/index.tsx`

- `ssr:false`; `beforeLoad` (`:6-10`) consulta `supabase.auth.getSession()`;
  com sessão → `redirect /dashboard`; sem sessão → `redirect /auth`. `component` retorna `null`.
- **Depende de:** nada. **É usada por:** ponto de entrada. **Ordem:** 1.

### 4.2 `/auth` — `src/routes/auth.tsx`

**Identificação.** Tela pública única com duas abas (`signin`/`signup`). Módulo: Autenticação.

**Guarda.** `beforeLoad` (`:14-18`) roda apenas no browser (retorna cedo quando
`typeof window === "undefined"`); se já há sessão → `redirect /dashboard`.

**Listener de sessão** (`:40-59`): `onAuthStateChange` reage a `SIGNED_IN` e `INITIAL_SESSION`;
usa `setTimeout(...,0)` para evitar deadlock do *navigator lock* do `supabase-js`
(comentário `:43-44`). Consulta `user_roles` (`role='master'`, `.maybeSingle()`) e navega com
`replace:true` para `/admin` (master) ou `/dashboard`.

**Validação (zod).**

| Schema | Regra | Mensagem |
| --- | --- | --- |
| `emailSchema` (`:23`) | `string().trim().email().max(255)` | "Email inválido" |
| `passwordSchema` (`:24`) | `string().min(6).max(100)` | "Mínimo 6 caracteres" |
| `nomeSchema` (`:25`) | `string().trim().min(2).max(100)` | "Informe seu nome" |

**Campos.**

| Campo | Técnico | Tipo | Obrigatório | Validação |
| --- | --- | --- | --- | --- |
| Email (login) | `si-email` | string/email | sim | `emailSchema` |
| Senha (login) | `si-password` | string | sim | `passwordSchema` |
| Nome (cadastro) | `su-nome` | string | sim | `nomeSchema` |
| Email (cadastro) | `su-email` | string/email | sim | `emailSchema` |
| Senha (cadastro) | `su-password` | string | sim | `passwordSchema` |

**Ação "Entrar"** (`handleSignIn`, `:63-77`): valida no cliente (erro → `toast.error`, sem chamada de
API); chama `supabase.auth.signInWithPassword`; erro → `toast.error(error.message)`; sucesso →
`toast.success("Bem-vindo!")` e a navegação ocorre pelo listener. Botão desabilitado enquanto
`loading` ("Entrando...").

**Ação "Cadastrar"** (`handleSignUp`, `:79-101`): valida nome/email/senha; chama
`supabase.auth.signUp({email, password, options:{emailRedirectTo: origin + "/dashboard", data:{nome}}})`;
sucesso → `toast.success("Conta criada! Você já pode entrar.")`, muda para a aba de login e
pré-preenche o email. Botão desabilitado enquanto `loading` ("Criando...").

**Efeito colateral no banco (Identificado).** `handle_new_user()` (trigger `AFTER INSERT ON auth.users`)
cria `profiles`, `nutrition_goals` e executa `seed_default_workout_templates(NEW.id)`.

**Depende de:** nada. **É usada por:** todas as telas protegidas. **Ordem:** 2.

### 4.3 Layout protegido — `src/routes/_authenticated/route.tsx`

- Rota pathless `/_authenticated`, `ssr:false`. `beforeLoad` (`:12-16`): `supabase.auth.getUser()`;
  sem usuário → `redirect /auth`; retorna `{user}` no contexto.
- Componente (`:20-56`): `useWaterReminderScheduler()`, `useViewAs()`, `SidebarProvider` +
  `AppSidebar` + header com `SidebarTrigger`.
- Banner condicional de visita (`:33-45`): "Modo somente leitura", nome/email do visitado e botão
  "Sair da visita" (`stopViewAs`).
- `<main>` envolve `<Outlet/>` em `<fieldset disabled={readOnly}>` (`:46-51`) — desabilita
  nativamente todos os controles quando em modo visita.

### 4.4 Navegação lateral — `src/components/app-sidebar.tsx`

- Query `["is-master"]` (`:50-63`) → `user_roles` (`role='master'`, `.maybeSingle()`); controla o
  grupo "Administração" com link `/admin` (`:111-127`).
- Grupos (`:21-43`): **Nutrição** (`/dashboard`, `/alimentacao`, `/alimentos`, `/hidratacao`,
  `/relatorios`), **Treinos** (`/treino-hoje`, `/modelos-treino`, `/planejamento-semanal`,
  `/treinos`, `/historico-treinos`), **Corpo** (`/evolucao-fisica`), **Conta** (`/perfil`).
- Item ativo: `pathname === item.url || pathname.startsWith(item.url + "/")` (`:78`).
- "Sair" (`:66-70`): `signOut()` → `toast.success("Você saiu da conta")` → `navigate("/auth", replace)`.

### 4.5 `useAuth` — `src/hooks/use-auth.ts`

Hook client-only: `getSession()` no mount + `onAuthStateChange`; retorna `{user, loading}`.
**Não identificado.** consumidores confirmados — os guardas usam checagens diretas em `beforeLoad`.

---

## 5. Escopo de dados e modo "Visitar usuário"

### 5.1 `src/lib/scoped-user.ts`

`useScopedUser()` (`:28-48`) retorna:

| Campo | Tipo | Significado |
| --- | --- | --- |
| `userId` | `string \| null` | dono dos dados exibidos (visitado, se houver; senão autenticado) |
| `authUserId` | `string \| null` | quem está autenticado de fato |
| `email` | `string \| null` | email correspondente |
| `readOnly` | `boolean` | `true` em modo visita |
| `isLoading` | `boolean` | `false` em modo visita (dado local) |

Contrato obrigatório para toda tela de dados pessoais (`:1-12`): usar `useScopedUser()`, incluir
`userId` na `queryKey`, filtrar `.eq("user_id", userId!)` e manter `enabled: !!userId`.

### 5.2 `src/lib/view-as.tsx`

- Chave `localStorage` `nutricontrol.viewAs`; tipo `ViewAsTarget = {id, nome, email}` (`:8-10`).
- `getViewAs()` (`:12-22`) leitura segura (null em SSR/parse inválido).
- `scopedAuthUser()` (`:28-35`) substitui `supabase.auth.getUser()` nas telas.
- `startViewAs(target)` (`:37-41`): grava e faz reload duro para `/dashboard` (descarta cache do admin).
- `stopViewAs()` (`:43-46`): remove e recarrega em `/admin`.
- `useViewAs()` (`:48-52`): `{viewAs, readOnly}` populado no cliente.

**Modelo de segurança (Identificado).** Leitura ampliada do Master vem de policies RLS
`FOR SELECT ... USING (has_role(auth.uid(),'master'))`. Escrita permanece restrita ao dono pelo RLS;
a UI reforça com `fieldset disabled`. As mutations de hidratação/evolução usam `scopedAuthUser()`
para nunca gravar em nome do usuário visitado.

---

## 6. Módulo Hidratação

### 6.1 `/hidratacao` — `src/routes/_authenticated/hidratacao.tsx`

**Depende de:** autenticação; opcionalmente `water_goals` (default 3000 ml). **É usada por:**
Dashboard (card de água), Relatórios (série de água), painel Master (aba Hidratação). **Ordem:** 7.

**Queries.** `water_goals` `.eq("user_id", userId!).maybeSingle()` (`:34`);
`water_logs` dos últimos 30 dias, `order created_at desc` (`:39-47`).

**Cálculos (Identificado).**

- `meta = goal.meta_ml ?? 3000` (`:49`)
- `consumido = Σ todayLogs.quantidade_ml` (`:51`)
- `pct = min(100, consumido / meta * 100)` (`:52`)
- `restante = max(0, meta - consumido)` (`:53`)
- meta gravada em ml: `round(litros * 1000)` (`:55-63`)

**Ações.**

| Ação | Efeito | Tabela |
| --- | --- | --- |
| Salvar meta | `upsert({user_id, meta_ml})` | `water_goals` |
| Botões 200/300/500/1000 ml e input manual (`v>0`) | `insert({user_id, data: hoje, quantidade_ml})` | `water_logs` |
| Excluir registro | `delete().eq("id", id)` | `water_logs` |

**Campos.** meta em litros (`number`, `step=0.1`); quantidade em ml (`number`, exige `v>0`).
Não há validação por schema — **Identificado** como validação inline apenas.

**Visualização.** `BarChart` (Recharts) com os últimos 14 dias agregados por `data` (`:84-94`, `:135-150`).

### 6.2 Lembretes de água

**`src/components/water-reminders-card.tsx`** (renderizado em `/perfil`):

- Query `water_reminders` filtrada por `userId` (`:33`).
- `save`: `upsert({user_id, ativo, horarios})` + `syncSchedule(payload)` (`:50-60`).
- `toggle(value)` (`:68-78`): ao ativar sem permissão, solicita; se negada, `toast.error` e não salva.
- `addHorario` valida `/^\d{2}:\d{2}$/` e duplicidade (`:80-86`); edição/remoção persistem via `save`.
- Alertas condicionais: navegador sem suporte, permissão negada (instruções por sistema) e sugestão
  de instalar como PWA quando `ativo && granted && !standalone` (`:122-145`).

**`src/lib/water-reminders.ts`**:

- `DEFAULT_HORARIOS`: 7 horários fixos de 08:00 a 20:00 (`:10`).
- `registerReminderWorker` registra `/water-reminder-sw.js` com `scope:"/"` (`:33-44`).
- `syncSchedule` envia `postMessage({type:"set-schedule", ativo, horarios})` e chama
  `enablePeriodicSync` (`:52-56`).
- `enablePeriodicSync`: `periodicSync.register("water-reminders", {minInterval: 15min})` sujeito à
  permissão `periodic-background-sync` (`:65-77`).
- `useWaterReminderScheduler` (`:121-163`): registra worker, carrega `water_reminders`, sincroniza e
  mantém `setInterval` de 20 s como fallback em primeiro plano; deduplica por dia via `localStorage`.
- **Lacuna identificada:** a leitura em `:129` usa `.maybeSingle()` **sem** `.eq("user_id", ...)`,
  contrariando o contrato de `scoped-user.ts`; em modo Master isso pode retornar linha de outro usuário.

**`public/water-reminder-sw.js`**: não cacheia assets do app, apenas a configuração
(`CONFIG_CACHE`/`CONFIG_URL`, `:4-5`, `:23-37`); `reschedule()` usa `setTimeout` por horário e
reagenda após disparar (`:66-83`); `fireDueReminders()` dispara horários vencidos há ≤15 min
(`:86-97`); eventos `message` (`set-schedule`/`check-now`/`test`), `periodicsync`, `sync`, `push`,
`notificationclick` (foca janela existente e navega para `/hidratacao`) (`:99-138`).

---

## 7. Módulo Evolução Física

### `/evolucao-fisica` — `src/routes/_authenticated/evolucao-fisica.tsx`

**Depende de:** `profiles` (altura e `peso_meta`), bucket `progress-photos`. **É usada por:**
Dashboard (última foto), painel Master (aba Evolução). **Ordem:** 13.

**Queries.** `profiles` por `id` (`:57-61`); `progress_photos` `order data desc` (`:63-71`).

**Upload** (`UploadCard`, `:200-252`).

| Campo | Tipo | Obrigatório | Default |
| --- | --- | --- | --- |
| `data` | date | sim | hoje |
| `categoria` | enum `frente\|lado\|costas` (`CATS`, `:36-40`) | sim | primeira opção |
| `peso_kg` | number | não | vazio |
| `observacoes` | text | não | vazio |
| `file` | file (`accept="image/*"`) | sim (checado em `:209`) | — |

Fluxo: `path = ${user.id}/${crypto.randomUUID()}.${ext}` (`:214-215`) →
`storage.from("progress-photos").upload(path, file)` (`:216`) → `insert` em `progress_photos`
(`:218-222`). Exclusão remove o objeto do Storage e a linha (`:73-80`).

**Exibição.** `SignedImage` (`:187-198`) gera `createSignedUrl(path, 3600)` (1 h) a cada mount.
Comparação lado a lado por data/categoria (`:102-131`, `:133-168`).

**Cálculos.**

- IMC: `peso_kg / (altura/100)^2` (`:151`, `:181`).
- Série de peso: um ponto por data (último peso do dia), ordem cronológica (`:264-274`).
- `delta` entre pontos consecutivos; `variacao = atual − primeiro`; `restam = atual − peso_meta`;
  `progresso = clamp(0,100, (primeiro − atual)/(primeiro − peso_meta) × 100)` (`:281-284`).
- Eixo Y: domínio base 20–140 kg, expansível (`:293-294`); `AreaChart` com `ReferenceLine` (meta) e
  `ReferenceDot` (último ponto).

---

## 8. Módulo Relatórios

### 8.1 `/relatorios` — `src/routes/_authenticated/relatorios.tsx`

**Depende de:** `meals`, `meal_foods`, `foods`, `water_logs`, `profiles.nome`. **Ordem:** 15.

- Presets de período: hoje, 7d, 30d, mês, ano, personalizado (`:22-39`), estados `preset`/`custom`.
- Queries: `profiles.nome` (`:48-55`); `meals` com join `meal_foods(id, quantidade, foods(*))`
  filtrado por `data` entre `range.from/to` (`:57-71`); `water_logs` do período (`:73-86`).
- Pipeline: `buildRows` → `totalsByDay` / `averagesByMeal` / `topFoods` / `totalsOverall` (`:88-92`).
- Séries por macronutriente com `__delta` entre dias consecutivos (`:95-110`); série de água por dia
  (`:112-122`).
- Abas: **Gráficos** (`TrendAreaChart` por macro + água), **Por refeição**
  (`HorizontalRankBar` + cards de médias), **Mais consumidos** (ranking + participação %).
- Exportações: botões PDF/Excel/CSV desabilitados quando `rows.length === 0` (`:162-164`).

### 8.2 `src/lib/reports.ts`

- `buildRows` (`:27-44`): expande `meals[].meal_foods[].foods` em
  `{data, refeicao, alimento, quantidade, unidade, nut}` via `computeNutrients`.
- `totalsByDay` (`:46-54`): soma por dia (`sumTotals`).
- `totalsByMeal` / `averagesByMeal` (`:56-92`): média por refeição dividida pelo **nº de dias em que
  aquela refeição foi registrada** (não pelo total de dias do período) — comentário na linha 65.
- `topFoods` (`:99-122`): `participacao = kcal_alimento / kcalTotal × 100` (1 casa);
  `mediaDiaria`/`kcalDia` divididos por `diasComRegistro`.
- `EXPORT_HEADERS` (`:125-129`) inclui as 13 vitaminas e 8 minerais.
- `exportCSV` (`:140-149`): separador `;`, BOM UTF-8, download por Blob.
- `exportXLSX` (`:151-165`): duas abas (Capa + Detalhado) via SheetJS.
- `exportPDF` (`:167-197`): `jspdf` + `autotable`, paisagem, capa com resumo + tabela detalhada.
- **Lacuna identificada:** **não existe exportação ODS**, embora tenha sido pedida — apenas
  CSV/XLSX/PDF estão implementados.

### 8.3 `src/components/charts.tsx`

- `CHART_COLORS` (`:15-22`): nutriente → variável CSS (tokens semânticos).
- `TrendAreaChart` (`:57-117`): `AreaChart` com gradiente por instância (`useId`) e tooltip que
  mostra `__delta` em relação ao ponto anterior.
- `HorizontalRankBar` (`:119-162`): barras horizontais, 5 cores cíclicas,
  altura dinâmica `max(160, n × 34)`.

---

## 9. Módulo Administração (Master)

### 9.1 Layout `/admin` — `src/routes/_authenticated/admin/route.tsx`

`beforeLoad` (`:6-16`): sem usuário → `/auth`; sem linha `master` em `user_roles` → `/dashboard`.
Esse guarda é **UX apenas**; a segurança real está em `assertMaster` (server) e nas policies RLS.
Layout indigo/slate com badge "Administrador", link "Voltar ao app", abas "Usuários" (`/admin`,
exato) e "Logs administrativos" (`/admin/logs`, prefixo) (`:20-23`), e faixa fixa de aviso de
somente leitura (`:68-72`).

### 9.2 `/admin` — `src/routes/_authenticated/admin/index.tsx`

- Server fns: `listAllUsers` (GET), `setUserAccountStatus` (POST) via `useServerFn`.
- Estados: `q` (busca) e `status` (`todos|ativo|desativado|bloqueado`); lista derivada em `useMemo`
  (`:63-75`).
- `statusOf(u)` (`:31-35`): `bloqueado_em` → `bloqueado`; senão `!ativo || banned` → `desativado`;
  senão `ativo`.
- Tabela: Usuário (nome + badge Master), Status, Cadastro (`toLocaleDateString('pt-BR')`),
  Último acesso (`last_sign_in_at` ou "—"), Ações.

| Botão | Ação | Regras |
| --- | --- | --- |
| Ver dados | `Link /admin/usuarios/$userId` | navegação simples |
| Visitar Usuário | `startViewAs({id,nome,email})` | reload duro para `/dashboard` |
| Desativar | `mutate({action:"desativar"})` | visível se `ativo`; desabilitado se `isPending` ou alvo master |
| Bloquear | `mutate({action:"bloquear"})` | idem |
| Reativar | `mutate({action:"ativar"})` | visível se desativado/bloqueado; desabilitado só por `isPending` |

Mutação (`:52-61`): sucesso → `toast.success("Status atualizado")` + invalida `["admin-users"]` e
`["admin-logs"]`; erro → `toast.error(e.message)`. Estados: "Carregando usuários...", caixa vermelha
com erro, linha "Nenhum usuário encontrado.".

### 9.3 `/admin/usuarios/$userId` — `usuarios.$userId.tsx`

Somente leitura; `getUserOverview` com `queryKey ["admin-user", userId]`. Cabeçalho com nome, email,
badge de status (banido = "sem acesso") e badge "somente leitura". Abas sem requisições extras:

- **Perfil:** peso, `peso_meta`, altura, idade, objetivo, cadastro, último acesso + card de metas
  nutricionais e meta de água.
- **Alimentação:** últimas refeições (limite 60), `mealKcal(m) = Σ (energia_kcal × quantidade)/100`
  (`:25-30`).
- **Treinos:** `workouts` (60), `series x repeticoes [+peso]`, status por `finalizado_em`.
- **Hidratação:** `waterByDay` agrupado por `data` (`:42-46`) com % da meta.
- **Evolução física:** grade de fotos com URL assinada (1 h); placeholder "sem imagem" se nula.

### 9.4 `/admin/logs` — `logs.tsx`

`listAdminLogs` (`queryKey ["admin-logs"]`), tabela somente leitura: data/hora, administrador
(`admin_email ?? admin_id`), ação (badge) e usuário alvo. Sem paginação na UI — backend limita a 300.

### 9.5 Server functions — `src/lib/admin.functions.ts`

Todas com `.middleware([requireSupabaseAuth])`.

| Função | Método | Input | Regras | Efeitos |
| --- | --- | --- | --- | --- |
| `amIMaster` | GET | — | RPC `has_role` | retorna `{master:boolean}` |
| `listAllUsers` | GET | — | `assertMaster` | pagina `auth.admin.listUsers({perPage:200})` e junta `profiles` + `user_roles` |
| `getUserOverview` | GET | `{userId: uuid}` (zod) | `assertMaster` | leitura paralela de `auth.users`, `profiles`, `nutrition_goals`, `meals`+`meal_foods`+`foods` (60), `workouts`+`workout_exercises`+`exercises` (60), `water_logs` (200), `progress_photos` (60), `water_goals`; gera signed URLs (3600 s) |
| `setUserAccountStatus` | POST | `{userId: uuid, action: ativar\|desativar\|bloquear}` | `assertMaster`; **proíbe alterar a própria conta** (`:149-151`) | `ban_duration` `"none"` ou `"876000h"`; atualiza `profiles` (`ativo`, `desativado_em`, `bloqueado_em`); grava `admin_audit_logs` |
| `listAdminLogs` | GET | — | `assertMaster` | `admin_audit_logs` order `created_at desc` limit 300 |

`src/lib/admin.server.ts`: `assertMaster` (`:11-20`) usa o client **do usuário** (`context.supabase.rpc("has_role")`)
e lança `Forbidden: acesso restrito a administradores`; `logAdminAction` (`:22-38`) insere auditoria
com `supabaseAdmin` (única via possível, pois não há policy de INSERT para `authenticated`).

---

## 10. Modelo de dados

### 10.1 Enums

- `goal_type`: `emagrecimento | manutencao | ganho_massa`
- `meal_type`: `cafe_da_manha | almoco | lanche | jantar | outro`
- `app_role`: `master | user`

### 10.2 Tabelas (`public`)

| Tabela | Colunas essenciais | PK / FK / índices | RLS |
| --- | --- | --- | --- |
| `profiles` | nome, peso, altura, idade, objetivo (default `manutencao`), `peso_meta`, `ativo` (default true), `bloqueado_em`, `desativado_em`, timestamps | PK `id` → `auth.users` | select/insert/update próprios; + master SELECT |
| `nutrition_goals` | calorias 2000, proteinas 120, carboidratos 250, gorduras 65, fibras 25 | PK `user_id` | ALL próprio; + master SELECT |
| `foods` | nome, categoria, `unidade_base` (default `g`), energia_kcal, proteina, carboidrato, gordura, fibra, sodio, 13 vitaminas, 8 minerais, `minerais`/`vitaminas` jsonb (legado), `fonte` (default `taco`), `user_id` nullable (null = base pública) | PK `id` | SELECT `user_id IS NULL OR = auth.uid()`; escrita própria; + master SELECT |
| `meals` | data (default hoje), horario, tipo (`meal_type`), observacao | PK `id`, idx `(user_id, data)` | ALL próprio; + master SELECT |
| `meal_foods` | quantidade | `meal_id` → `meals` CASCADE, `food_id` → `foods` RESTRICT, idx `(meal_id)` | via `EXISTS meals.user_id = auth.uid()`; + master SELECT |
| `exercise_categories` | nome (UNIQUE), descricao | PK `id` | SELECT liberado a autenticados |
| `exercises` | nome, `categoria_id` (SET NULL), grupo_muscular, equipamento, ativo, `user_id` nullable, `fonte` (default `sistema`) | PK `id` | SELECT público+próprio; INSERT/DELETE próprios; **UPDATE `USING(true)` para qualquer autenticado** |
| `workouts` | data, horario, duracao_min, observacoes, `finalizado_em` | PK `id` | ALL próprio; + master SELECT |
| `workout_exercises` | peso, series, repeticoes, observacoes, ordem (default 0), `concluido` (default false) | `workout_id` CASCADE, `exercise_id` RESTRICT | via `EXISTS workouts.user_id = auth.uid()`; + master SELECT |
| `workout_templates` | nome, descricao, objetivo, ativo | PK `id` | ALL próprio; + master SELECT |
| `template_exercises` | ordem, series (3), repeticoes (`'10'`), descanso_segundos (60), observacoes | `template_id` CASCADE, `exercise_id` CASCADE | via `EXISTS templates.user_id = auth.uid()`; + master SELECT |
| `weekly_plans` | nome, ativo (default false) | PK `id` | ALL próprio; + master SELECT |
| `weekly_plan_days` | `dia_semana` (CHECK 0-6), `template_id` (SET NULL), rotulo | UNIQUE `(plan_id, dia_semana)` | via `EXISTS plans.user_id = auth.uid()`; + master SELECT |
| `water_goals` | `meta_ml` (default 3000) | PK `user_id` | ALL próprio; + master SELECT |
| `water_logs` | data (default hoje), `quantidade_ml` (CHECK > 0) | idx `(user_id, data)` | ALL próprio; + master SELECT |
| `water_reminders` | ativo (default true), `horarios text[]` (7 horários) | PK `user_id` (**sem FK para `auth.users`**) | ALL próprio; + master SELECT |
| `progress_photos` | data, categoria (CHECK `frente\|lado\|costas`), `storage_path`, `peso_kg`, observacoes | idx `(user_id, data DESC)` | ALL próprio; + master SELECT |
| `user_roles` | role (`app_role`), UNIQUE `(user_id, role)` | PK `id` | SELECT próprio ou master; escrita só `service_role` |
| `admin_audit_logs` | admin_email, target_user_id, target_email, acao, detalhes jsonb | idx `created_at DESC` | SELECT só master; INSERT só `service_role` |

### 10.3 Relacionamentos

```text
auth.users 1─1 profiles
auth.users 1─1 nutrition_goals / water_goals / water_reminders
auth.users 1─N meals ─N meal_foods ─1 foods ─N exercise? (não)
foods            (user_id NULL = base TACO compartilhada)
auth.users 1─N workouts ─N workout_exercises ─1 exercises ─1 exercise_categories
auth.users 1─N workout_templates ─N template_exercises ─1 exercises
auth.users 1─N weekly_plans ─N weekly_plan_days ─1 workout_templates
auth.users 1─N water_logs / progress_photos / user_roles / admin_audit_logs
```

### 10.4 Funções e triggers

- `update_updated_at_column()` — trigger `BEFORE UPDATE` nas tabelas com `updated_at`;
  `EXECUTE` revogado de `PUBLIC`/`anon`/`authenticated`.
- `handle_new_user()` — `AFTER INSERT ON auth.users`; cria `profiles`, `nutrition_goals` e chama
  `seed_default_workout_templates`.
- `has_role(_user_id, _role)` — `STABLE SECURITY DEFINER`, base de todas as policies "Master";
  `EXECUTE` só para `authenticated`/`service_role`.
- `seed_default_workout_templates(_user_id)` / `seed_my_default_workout_templates()` — criam
  3 modelos padrão (Peito, Costas, Perna) com 5 exercícios cada, somente se o usuário não tiver
  modelos.

### 10.5 Storage

Bucket `progress-photos` (privado). Policies em `storage.objects`
(migration `20260624124908`): SELECT/INSERT/UPDATE/DELETE com
`foldername(name)[1] = auth.uid()::text`; `Master le fotos de progresso` (SELECT) com
`has_role(auth.uid(),'master')`. Padrão de caminho: `${userId}/${uuid}.${ext}`.
**Lacuna identificada:** nenhuma migration cria o bucket e `supabase/config.toml` só tem
`project_id` — limites de tamanho e MIME types **não identificados** no repositório.

---
