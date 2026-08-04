# Estrutura do Código

Este projeto usa **roteamento por arquivos** (TanStack Router). Não existe `/pages`; as telas ficam em `src/routes`.

## Diretórios

| Diretório | Finalidade |
| --- | --- |
| `src/routes/` | Telas do sistema. Cada arquivo é uma rota (`/dashboard`, `/perfil`, ...). |
| `src/routes/_authenticated/` | Subárvore protegida: exige usuário autenticado (gate em `route.tsx`). |
| `src/components/` | Componentes reutilizáveis de domínio (ex.: `water-reminders-card.tsx`, `app-sidebar.tsx`). |
| `src/components/ui/` | Primitivos do shadcn/ui (button, card, dialog, select, chart...). Não conter regra de negócio. |
| `src/hooks/` | Hooks personalizados (`use-auth.ts`, `use-mobile.tsx`). |
| `src/integrations/supabase/` | Clientes e middlewares Supabase — equivale à camada de "services". |
| `src/lib/` | Regras de negócio puras e utilitários (cálculo nutricional, relatórios, lembretes, helpers). |
| `src/styles.css` | Tokens de design (cores semânticas), Tailwind v4. |
| `public/` | Assets estáticos, `manifest.webmanifest`, ícones e `water-reminder-sw.js`. |
| `supabase/migrations/` | Histórico versionado do schema do banco. |
| `docs/` | Documentação técnica. |

> Tipos: os tipos do banco ficam em `src/integrations/supabase/types.ts` (gerado automaticamente — **não editar**). Tipos locais de tela são declarados no próprio arquivo da rota/componente.

## Principais arquivos

### Infraestrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `src/router.tsx` | Cria o router, injeta o `QueryClient` no contexto. |
| `src/routes/__root.tsx` | Shell HTML, `head()` (SEO, manifest, ícones, theme-color), `QueryClientProvider`, `Toaster`, páginas de erro/404. |
| `src/start.ts` | Middlewares do TanStack Start (inclui o attacher de bearer token do Supabase). |
| `src/integrations/supabase/client.ts` | Cliente do navegador (anon key + sessão do usuário). RLS aplicada. |
| `src/integrations/supabase/client.server.ts` | Cliente admin (service role) — apenas servidor, uso privilegiado. |
| `src/integrations/supabase/auth-middleware.ts` | `requireSupabaseAuth` para server functions autenticadas. |
| `src/hooks/use-auth.ts` | Estado de sessão/usuário no cliente. |
| `src/lib/error-capture.ts`, `lovable-error-reporting.ts` | Captura e report de erros de runtime. |

### Telas (rotas)

| Arquivo | Tela |
| --- | --- |
| `routes/index.tsx` | Landing pública. |
| `routes/auth.tsx` | Login e cadastro (email/senha). |
| `routes/_authenticated/route.tsx` | Gate de autenticação + layout com `AppSidebar` + scheduler de lembretes. |
| `routes/_authenticated/dashboard.tsx` | Resumo do dia: macros, metas, água, treino do dia, última foto. |
| `routes/_authenticated/alimentacao.tsx` | Registro de refeições e itens consumidos. |
| `routes/_authenticated/alimentos.tsx` | Base de alimentos (TACO + personalizados), macros e micros. |
| `routes/_authenticated/perfil.tsx` | Dados pessoais, **peso meta**, metas nutricionais e lembretes de água. |
| `routes/_authenticated/relatorios.tsx` | Relatórios por período, gráficos e exportações. |
| `routes/_authenticated/treinos.tsx` | Catálogo de exercícios (criar/editar/duplicar). |
| `routes/_authenticated/modelos-treino.tsx` | Modelos (Treino A/B/C) com drag & drop de exercícios. |
| `routes/_authenticated/planejamento-semanal.tsx` | Modelo por dia da semana. |
| `routes/_authenticated/treino-hoje.tsx` | Execução do treino do dia, comparação de carga, finalizar treino. |
| `routes/_authenticated/historico-treinos.tsx` | Histórico, filtros por data, volume e exportações. |
| `routes/_authenticated/hidratacao.tsx` | Registro de água, meta e histórico. |
| `routes/_authenticated/evolucao-fisica.tsx` | Fotos por data/categoria, comparação e gráfico de peso vs. meta. |

### Componentes e libs de domínio

| Arquivo | Responsabilidade |
| --- | --- |
| `components/app-sidebar.tsx` | Navegação principal (desktop/mobile). |
| `components/water-reminders-card.tsx` | UI de configuração dos lembretes de água (ativar, horários, permissão, teste). |
| `lib/water-reminders.ts` | Registro do service worker, permissão, sincronização/reagendamento dos horários e fallback em app aberto. |
| `lib/nutrition.ts` | Cálculo proporcional de macros e micros por quantidade consumida. |
| `lib/reports.ts` | Agregação de períodos e geração de PDF/XLSX/ODS/CSV. |
| `public/water-reminder-sw.js` | Service worker: agenda/dispara notificações, `periodicsync`, clique abre `/hidratacao`. |
