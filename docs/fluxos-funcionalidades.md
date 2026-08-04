# Fluxos das Funcionalidades

Cada seção indica **telas**, **componentes** e **tabelas** envolvidas.

## 1. Login e cadastro

- Telas: `routes/auth.tsx` (pública), `routes/index.tsx` (landing).
- Fluxo: email/senha via `supabase.auth.signInWithPassword` / `signUp`. No cadastro, o trigger `handle_new_user()` cria `profiles` e `nutrition_goals`.
- Proteção: `routes/_authenticated/route.tsx` (`ssr: false`) chama `supabase.auth.getUser()` e redireciona para `/auth` quando não há sessão.
- Tabelas: `auth.users`, `profiles`, `nutrition_goals`.

## 2. Perfil

- Tela: `_authenticated/perfil.tsx`; componente `water-reminders-card.tsx`.
- Fluxo: carrega perfil e metas (Query `["profile"]`, `["goals"]`), grava com `upsert`. Campos: nome, peso, **peso meta**, altura, idade, objetivo, metas de macros.
- Tabelas: `profiles`, `nutrition_goals`, `water_reminders`.

## 3. Alimentação

- Telas: `_authenticated/alimentacao.tsx` (registro), `_authenticated/alimentos.tsx` (base).
- Fluxo: busca alimento → informa quantidade → `meal_foods` vinculado a uma `meals` do dia. `lib/nutrition.ts` calcula os nutrientes proporcionalmente (valores por 100 g × quantidade/100).
- Tabelas: `foods`, `meals`, `meal_foods`, `nutrition_goals`.

## 4. Dashboard

- Tela: `_authenticated/dashboard.tsx`.
- Fluxo: agrega refeições do dia e compara com metas; cards de água, treino programado e última foto de progresso.
- Tabelas: `meals`, `meal_foods`, `foods`, `nutrition_goals`, `water_logs`, `water_goals`, `weekly_plans`, `weekly_plan_days`, `progress_photos`.

## 5. Exercícios

- Tela: `_authenticated/treinos.tsx`.
- Fluxo: lista biblioteca padrão (`user_id IS NULL`) + exercícios do usuário; permite criar, duplicar e editar.
- Tabelas: `exercises`, `exercise_categories`.

## 6. Modelos de treino (com drag & drop)

- Tela: `_authenticated/modelos-treino.tsx`.
- Fluxo:
  1. Criar/editar/duplicar modelo (`workout_templates`).
  2. Expandir modelo → listar `template_exercises` com `ORDER BY ordem, created_at`.
  3. Adicionar/remover exercícios, editar séries/reps/descanso inline.
  4. **Reordenar**: `DndContext` + `SortableContext` do dnd-kit. No `onDragEnd`:
     - `arrayMove` recalcula `ordem = índice`;
     - `queryClient.setQueryData` atualiza a UI imediatamente;
     - `persistOrder` grava cada item sequencialmente (`update ordem`) verificando erro;
     - **não há invalidate no sucesso**, evitando que um refetch sobrescreva a nova ordem. Em caso de erro, mostra toast e refaz o fetch.
  5. Importar exercícios de outro modelo.
- Tabelas: `workout_templates`, `template_exercises`, `exercises`.

## 7. Planejamento semanal

- Tela: `_authenticated/planejamento-semanal.tsx`.
- Fluxo: define o modelo de cada dia da semana; sem modelo = descanso.
- Tabelas: `weekly_plans`, `weekly_plan_days`, `workout_templates`.

## 8. Treino de hoje

- Tela: `_authenticated/treino-hoje.tsx`.
- Fluxo: identifica o dia da semana → modelo do plano ativo → cria/abre `workouts` do dia → registra `workout_exercises` (carga, séries, reps) → compara com a última execução do mesmo exercício (Δkg) → marca `concluido` → **Finalizar treino** grava `finalizado_em` e `duracao_min` (com opção de reabrir).
- Tabelas: `weekly_plans`, `weekly_plan_days`, `workout_templates`, `template_exercises`, `workouts`, `workout_exercises`, `exercises`.

## 9. Histórico de treinos

- Tela: `_authenticated/historico-treinos.tsx`.
- Fluxo: filtros por data, volume por grupo muscular, frequência, evolução de carga por exercício e exportação XLSX/ODS/CSV.
- Tabelas: `workouts`, `workout_exercises`, `exercises`.

## 10. Controle de água

- Tela: `_authenticated/hidratacao.tsx`.
- Fluxo: meta diária (`water_goals`), atalhos rápidos de registro, soma do dia e histórico.
- Tabelas: `water_goals`, `water_logs`.

## 11. Lembretes de água (notificações)

- Componente: `components/water-reminders-card.tsx`; lib: `lib/water-reminders.ts`; worker: `public/water-reminder-sw.js`.
- Fluxo:
  1. Ao ativar, o app pede permissão (`Notification.requestPermission`) e registra o service worker.
  2. Os horários são salvos em `water_reminders` e enviados ao worker (`postMessage {type:'set-schedule'}`).
  3. O worker **cancela os agendamentos antigos** e reagenda todos os horários (persistindo a configuração no Cache Storage), disparando `showNotification` no horário.
  4. `periodicsync`/`sync` (quando suportados) e o retorno do app ao foco (`check-now`) reativam o worker e disparam horários vencidos.
  5. Clique na notificação foca/abre `/hidratacao`.
  6. Se a permissão estiver negada, a UI explica como reativar nas configurações do aparelho; se o app não estiver instalado, sugere “Adicionar à tela de início” (necessário no iOS e mais confiável no Android para entrega com o app fechado).
- Limitação de plataforma: navegadores não oferecem alarme local garantido para web apps; a entrega com o app totalmente encerrado depende de PWA instalado e do suporte a Periodic Background Sync. Para garantia total em qualquer aparelho seria necessário Web Push com servidor (VAPID) ou um app nativo/Capacitor.
- Tabelas: `water_reminders`.

## 12. Evolução física

- Tela: `_authenticated/evolucao-fisica.tsx`.
- Fluxo:
  1. Upload de foto (data, categoria frente/lado/costas, peso, observações) → arquivo no bucket privado `progress-photos`, metadados em `progress_photos`.
  2. Exibição via URLs assinadas (1h).
  3. Comparação lado a lado entre duas datas por categoria.
  4. **Gráfico de peso**: um ponto por data (último peso do dia), linha contínua, linha horizontal tracejada com o `peso_meta` do perfil.
  5. Indicadores: peso atual, meta, quanto falta, quanto foi perdido/ganho e percentual de progresso `((primeiro − atual) / (primeiro − meta)) × 100`.
- Tabelas: `progress_photos`, `profiles` (altura para IMC e `peso_meta`).

## 13. Relatórios

- Tela: `_authenticated/relatorios.tsx`; lib `lib/reports.ts`.
- Fluxo: período (Hoje / 7d / 30d / personalizado) → agregação de refeições e nutrientes → gráficos → exportação PDF (jspdf), Excel/ODS/CSV (xlsx).
- Tabelas: `meals`, `meal_foods`, `foods`, `nutrition_goals`, `profiles`.
