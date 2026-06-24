# Plano — Expansão NutriControl (Treinos, Hidratação, Evolução Física)

Tudo é aditivo. Nada existente é removido ou alterado de forma incompatível.

## 1. Banco de dados (1 migration)

Novas tabelas (todas com RLS por `user_id`, grants para `authenticated` + `service_role`, trigger `updated_at`):

- `workout_templates` — id, user_id, nome, descricao, objetivo, ativo
- `template_exercises` — id, template_id, exercise_id, ordem, series, repeticoes, descanso_segundos, observacoes
- `weekly_plans` — id, user_id, nome, ativo
- `weekly_plan_days` — id, plan_id, dia_semana (0–6), template_id (nullable p/ descanso), rotulo
- `water_goals` — id, user_id, meta_ml (default 3000)
- `water_logs` — id, user_id, data, quantidade_ml, criado_em
- `photo_categories` — enum/tabela seed: frente, lado, costas
- `progress_photos` — id, user_id, data, categoria, storage_path, peso_kg, observacoes

Reutilizamos `workouts` + `workout_exercises` já existentes para o "Treino de Hoje" / histórico (já têm peso/séries/reps/observações). Não há migração destrutiva.

Ajuste em `exercises`: relaxar RLS para permitir **UPDATE** dos exercícios padrão (`user_id IS NULL`) pelo próprio usuário autenticado — sem deletar. Mantém leitura pública autenticada.

Storage: bucket `progress-photos` (privado) + policies por `user_id` no prefixo do path.

## 2. Frontend — novas rotas

Todas sob `_authenticated/`:

- `/exercicios` (existente `/treinos` renomeado conceitualmente): adicionar **Editar** e **Duplicar** em qualquer exercício (inclusive padrões).
- `/modelos-treino` — CRUD de `workout_templates` + exercícios (séries/reps/descanso/obs). Duplicar modelo, importar exercícios de outro modelo.
- `/planejamento-semanal` — grade Seg→Dom, associar template a cada dia, múltiplos planos, duplicar semana, ativar plano.
- `/treino-hoje` — lê plano ativo + dia atual → renderiza template → registra `workouts` + `workout_exercises`. Mostra comparação com último registro do mesmo exercício (Δ peso).
- `/hidratacao` — meta, botões rápidos (+200/+300/+500/+1L), input manual, progresso do dia, histórico, gráficos diário/semanal/mensal.
- `/evolucao-fisica` — upload por categoria (Frente/Lado/Costas), timeline, comparador lado-a-lado entre duas datas, exibição com peso/IMC do dia.

## 3. Dashboard

Adicionar cards: Água hoje + meta, Treino de hoje, Última foto (+ dias desde), Evolução de carga (top exercício).

## 4. Sidebar

Acrescentar entradas: Modelos de Treino, Planejamento Semanal, Treino de Hoje, Hidratação, Evolução Física. Manter as existentes.

## 5. Detalhes técnicos

- Uploads via `supabase.storage` (bucket privado + signed URLs).
- Gráficos com `recharts` (já instalado).
- Cálculo de IMC reutiliza perfil/altura existente.
- Comparação de carga: `select ... order by data desc limit 1` por exercise_id antes do registro.
- Validação com Zod nos formulários.
- Responsivo mobile (grid → stack).

## 6. Entrega

1. Migration (tabelas + RLS + grants + bucket policies + ajuste exercises UPDATE).
2. Após aprovação: tipos regenerados → código frontend + libs auxiliares (`src/lib/workouts.ts`, `src/lib/water.ts`, `src/lib/photos.ts`).
3. Sidebar + Dashboard atualizados.
4. Build verde.

Sem dados mockados; tudo persistido no Supabase.
