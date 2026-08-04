# Diagramas

Diagramas em Mermaid (renderizados automaticamente pelo GitHub).

## 1. Arquitetura

```mermaid
flowchart TD
  U[Usuário] --> APP[App React 19 / TanStack Router]
  APP --> Q[TanStack Query cache]
  APP --> SDK[supabase-js  anon key + JWT]
  SDK --> AUTH[Supabase Auth]
  SDK --> DB[(Postgres + RLS)]
  SDK --> ST[Storage privado: progress-photos]
  APP --> SW[Service Worker: lembretes de água]
  SW --> N[Notificações do sistema]
  APP -. lógica de servidor opcional .-> SF[TanStack server functions]
  SF --> DB
```

## 2. Fluxo de autenticação

```mermaid
sequenceDiagram
  participant U as Usuário
  participant A as /auth
  participant S as Supabase Auth
  participant G as _authenticated/route.tsx
  U->>A: email + senha
  A->>S: signInWithPassword / signUp
  S-->>A: sessão (JWT)
  Note over S: no signUp, trigger cria profiles e nutrition_goals
  U->>G: acessa rota protegida
  G->>S: getUser()
  S-->>G: usuário válido
  G-->>U: renderiza tela (RLS filtra dados)
```

## 3. Reordenação de exercícios (drag & drop)

```mermaid
sequenceDiagram
  participant U as Usuário
  participant C as modelos-treino.tsx
  participant QC as Query cache
  participant DB as template_exercises
  U->>C: arrasta e solta exercício
  C->>C: arrayMove + ordem = índice
  C->>QC: setQueryData (UI já reordenada)
  C->>DB: UPDATE ordem (sequencial, item a item)
  DB-->>C: ok (sem invalidate → ordem preservada)
  Note over C,DB: em caso de erro: toast + refetch da ordem real
```

## 4. Lembretes de água

```mermaid
flowchart LR
  P[Perfil: horários] --> DB[(water_reminders)]
  P --> PERM{Permissão concedida?}
  PERM -- não --> AV[Orienta ativar nas configurações]
  PERM -- sim --> SWREG[Registra service worker]
  DB --> MSG[postMessage set-schedule]
  MSG --> SWREG
  SWREG --> CANC[Cancela agendamentos antigos]
  CANC --> AG[Agenda todos os horários]
  AG --> NOTIF[Notificação do sistema]
  NOTIF --> HID[/hidratacao/]
  FOCO[App volta ao foco / periodicsync] --> AG
```

## 5. Evolução física e gráfico de peso

```mermaid
flowchart TD
  UP[Upload de foto + peso] --> STG[Storage progress-photos]
  UP --> PP[(progress_photos)]
  PP --> SER[Série: data → peso]
  PROF[(profiles.peso_meta)] --> GR
  SER --> GR[LineChart + linha da meta]
  GR --> IND[Peso atual, meta, restam, variação, progresso %]
```

## 6. Modelo entidade-relacionamento

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1:1"
  AUTH_USERS ||--|| NUTRITION_GOALS : "1:1"
  AUTH_USERS ||--o{ MEALS : "1:N"
  MEALS ||--o{ MEAL_FOODS : "1:N"
  FOODS ||--o{ MEAL_FOODS : "1:N"
  AUTH_USERS ||--o{ FOODS : "personalizados"
  EXERCISE_CATEGORIES ||--o{ EXERCISES : "1:N"
  AUTH_USERS ||--o{ EXERCISES : "personalizados"
  AUTH_USERS ||--o{ WORKOUT_TEMPLATES : "1:N"
  WORKOUT_TEMPLATES ||--o{ TEMPLATE_EXERCISES : "1:N"
  EXERCISES ||--o{ TEMPLATE_EXERCISES : "1:N"
  AUTH_USERS ||--o{ WEEKLY_PLANS : "1:N"
  WEEKLY_PLANS ||--o{ WEEKLY_PLAN_DAYS : "1:N"
  WORKOUT_TEMPLATES ||--o{ WEEKLY_PLAN_DAYS : "1:N"
  AUTH_USERS ||--o{ WORKOUTS : "1:N"
  WORKOUTS ||--o{ WORKOUT_EXERCISES : "1:N"
  EXERCISES ||--o{ WORKOUT_EXERCISES : "1:N"
  AUTH_USERS ||--|| WATER_GOALS : "1:1"
  AUTH_USERS ||--|| WATER_REMINDERS : "1:1"
  AUTH_USERS ||--o{ WATER_LOGS : "1:N"
  AUTH_USERS ||--o{ PROGRESS_PHOTOS : "1:N"
```

## 7. Fluxo frontend → banco

```mermaid
flowchart LR
  CMP[Componente] --> M[useMutation]
  M --> SDK[supabase-js]
  SDK --> RLS{RLS auth.uid}
  RLS -- permitido --> T[(Tabela)]
  T --> TRG[trigger updated_at]
  M --> INV[invalidateQueries]
  INV --> RQ[useQuery refetch]
  RQ --> CMP
```
