# NutriControl — Documentação Técnica

> Documentação versionada junto ao código. Atualize estes arquivos sempre que uma nova funcionalidade for implementada.

## 1. Objetivo do projeto

O **NutriControl** é um sistema web responsivo (PWA) de controle pessoal de saúde. Ele permite:

- Registrar a alimentação diária e acompanhar calorias, macronutrientes, vitaminas e minerais (base TACO + alimentos próprios).
- Definir metas nutricionais e acompanhar o progresso diário.
- Planejar e executar treinos (modelos, planejamento semanal, treino do dia, progressão de carga, histórico).
- Controlar a hidratação com metas, histórico e lembretes por notificação.
- Acompanhar a evolução física com fotos categorizadas, comparação por data e gráfico de peso vs. meta.
- Gerar relatórios (Hoje, 7d, 30d, personalizado) com exportação em PDF, Excel, ODS e CSV.

## 2. Tecnologias utilizadas

| Camada | Tecnologia |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR/SSG) |
| Roteamento | TanStack Router (rotas baseadas em arquivos) |
| Dados/cache | TanStack Query v5 |
| Build | Vite 7 |
| Estilo | Tailwind CSS v4 + shadcn/ui (Radix) |
| Gráficos | Recharts |
| Drag & drop | dnd-kit |
| Exportação | jspdf, jspdf-autotable, xlsx |
| Notificações | sonner (toasts) + Web Notifications/Service Worker |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| Runtime servidor | Edge/Worker (server functions do TanStack Start) |

## 3. Arquitetura da aplicação

```
Navegador (React 19 + TanStack Router)
        │  supabase-js (anon key, sessão do usuário)
        ▼
Supabase
 ├── Auth (email/senha)  → auth.users → trigger handle_new_user()
 ├── Postgres + RLS      → todas as tabelas de domínio
 └── Storage (privado)   → bucket progress-photos (URLs assinadas)

Service Worker (public/water-reminder-sw.js)
 └── notificações locais de hidratação
```

Pontos-chave:

- **Sem API própria adicional**: o acesso a dados é feito direto do cliente via `supabase-js`, protegido por **RLS** (cada usuário só vê os próprios registros). Quando lógica de servidor for necessária, usar `createServerFn` do TanStack Start (`src/lib/*.functions.ts`) — **não** usar Supabase Edge Functions neste stack.
- **Autenticação**: sessão do Supabase persistida no navegador; rotas protegidas ficam sob `src/routes/_authenticated/`.
- **Cache**: TanStack Query com `queryKey` por domínio (`["meals", data]`, `["template_exercises", templateId]`, ...).

## 4. Executando localmente

Requisitos: Node 20+ (ou Bun) e as variáveis do Supabase.

```bash
bun install          # ou: npm install
bun run dev          # http://localhost:8080
```

`.env` (gerado pela integração Supabase):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

Nunca comitar chaves de service role.

## 5. Build e publicação

```bash
bun run build        # build de produção
bun run start        # roda o build localmente (quando aplicável)
```

Publicação: pelo botão **Publish** do Lovable (deploy do build de produção). Alterações de banco são aplicadas via **migrations** (`supabase/migrations/`) — nunca editando o banco manualmente em produção.

## 6. Estrutura geral de pastas

```
public/                 Assets estáticos, manifest PWA, service worker de lembretes
src/
├── components/         Componentes reutilizáveis (incl. ui/ do shadcn)
├── hooks/              Hooks personalizados (auth, mobile)
├── integrations/       Clientes Supabase e middlewares de auth
├── lib/                Regras de negócio e utilitários (nutrição, relatórios, lembretes)
├── routes/             Telas (roteamento por arquivos)
│   ├── __root.tsx      Layout raiz, head/SEO, providers
│   ├── auth.tsx        Login e cadastro (pública)
│   ├── index.tsx       Landing (pública)
│   └── _authenticated/ Telas protegidas
├── styles.css          Tokens de design e Tailwind
└── router.tsx          Criação do router
supabase/               config.toml e migrations
docs/                   Esta documentação
```

## 7. Índice da documentação

- [Estrutura do código](./estrutura-do-codigo.md)
- [Banco de dados](./banco-de-dados.md)
- [Fluxos das funcionalidades](./fluxos-funcionalidades.md)
- [Organização e convenções](./organizacao-projeto.md)
- [Diagramas](./diagramas.md)
