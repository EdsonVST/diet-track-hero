# Banco de Dados

Postgres gerenciado pelo Supabase, schema `public`. **Todas** as tabelas de usuário têm RLS habilitada e políticas baseadas em `auth.uid()`.

Convenções: `id uuid` (PK, `gen_random_uuid()`), `created_at`/`updated_at` `timestamptz` (trigger `update_updated_at_column`), datas de registro em `date`, horários em `time`.

## Enums

- `goal_type`: `emagrecimento`, `manutencao`, `ganho_massa`
- `meal_type`: `cafe_da_manha`, `almoco`, `lanche`, `jantar`, `outro`

---

## Perfil e metas

### `profiles`
Dados pessoais do usuário. Criada automaticamente no cadastro.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK**, FK → `auth.users.id` | Usuário dono do perfil |
| `nome` | text | Nome exibido |
| `peso` | numeric | Peso atual (kg) |
| `peso_meta` | numeric | **Meta de peso (kg)** usada no gráfico de evolução |
| `altura` | numeric | Altura (cm), base do IMC |
| `idade` | integer | Idade |
| `objetivo` | goal_type | Objetivo do usuário |
| `created_at`/`updated_at` | timestamptz | Auditoria |

### `nutrition_goals`
Metas diárias. Criada automaticamente no cadastro.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `user_id` | uuid **PK**, FK → `auth.users.id` | Dono |
| `calorias`, `proteinas`, `carboidratos`, `gorduras`, `fibras` | numeric | Metas diárias |

---

## Alimentação

### `foods`
Base nutricional: itens da TACO (`user_id IS NULL`, `fonte='taco'`) e alimentos do usuário.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | Identificador |
| `user_id` | uuid FK → `auth.users.id` (nullable) | `NULL` = item público da base |
| `nome`, `categoria`, `unidade_base` | text | Identificação e unidade (padrão `g`) |
| `energia_kcal`, `proteina`, `carboidrato`, `gordura`, `fibra`, `sodio` | numeric | Valores por 100 g/ml |
| `vit_a` … `vit_k` | numeric | 13 vitaminas |
| `calcio`, `ferro`, `magnesio`, `fosforo`, `potassio`, `zinco`, `selenio` | numeric | Minerais |
| `minerais`, `vitaminas` | jsonb | Campos extras livres |
| `fonte` | text | `taco` ou `usuario` |

Leitura permitida quando `user_id IS NULL OR user_id = auth.uid()`; escrita apenas nos próprios itens.

### `meals`
Refeição de um dia.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `user_id` | uuid FK → `auth.users.id` | Dono |
| `data` | date | Dia da refeição (default hoje) |
| `horario` | time | Hora |
| `tipo` | meal_type | Café, almoço, lanche, jantar, outro |
| `observacao` | text | Notas |

### `meal_foods`
Itens de uma refeição (N:N entre `meals` e `foods`).

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `meal_id` | uuid FK → `meals.id` | Refeição |
| `food_id` | uuid FK → `foods.id` | Alimento |
| `quantidade` | numeric | Quantidade na unidade base |

RLS via `EXISTS` na refeição dona.

---

## Treinos

### `exercise_categories`
Categorias (Peito, Costas, Ombros, Pernas, Cardio...). Leitura para autenticados.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `nome`, `descricao` | text | |

### `exercises`
Catálogo de exercícios (biblioteca padrão com `user_id IS NULL` + criados pelo usuário).

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `categoria_id` | uuid FK → `exercise_categories.id` | Categoria |
| `user_id` | uuid FK → `auth.users.id` (nullable) | `NULL` = exercício do sistema |
| `nome`, `grupo_muscular`, `equipamento`, `descricao` | text | Metadados |
| `ativo` | boolean | Visível na seleção |
| `fonte` | text | `sistema` ou `usuario` |

### `workout_templates`
Modelos reutilizáveis (Treino A/B/C, Push/Pull/Legs).

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `user_id` | uuid FK → `auth.users.id` | Dono |
| `nome`, `descricao`, `objetivo` | text | |
| `ativo` | boolean | |

### `template_exercises`
Exercícios de um modelo, **ordenados**.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `template_id` | uuid FK → `workout_templates.id` | Modelo |
| `exercise_id` | uuid FK → `exercises.id` | Exercício |
| `ordem` | integer | **Posição na lista (0-based)** — persistida pelo drag & drop |
| `series` | integer | Séries planejadas |
| `repeticoes` | text | Ex.: `10`, `8-12` |
| `descanso_segundos` | integer | Descanso |
| `observacoes` | text | Notas |

Leituras usam `ORDER BY ordem, created_at`; o reordenamento grava `ordem = índice` de cada item.

### `weekly_plans` / `weekly_plan_days`
Planejamento semanal.

`weekly_plans`: `id` PK, `user_id` FK, `nome`, `ativo`.
`weekly_plan_days`: `id` PK, `plan_id` FK → `weekly_plans.id`, `dia_semana` (0=domingo … 6=sábado), `template_id` FK → `workout_templates.id` (nullable = descanso), `rotulo`.

### `workouts`
Sessão de treino executada.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `user_id` | uuid FK → `auth.users.id` | Dono |
| `data` | date | Dia |
| `horario` | time | Início |
| `duracao_min` | integer | Duração calculada ao finalizar |
| `finalizado_em` | timestamptz | `NULL` = treino em aberto |
| `observacoes` | text | |

### `workout_exercises`
Registro de execução (carga/séries/reps) por exercício.

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `workout_id` | uuid FK → `workouts.id` | Sessão |
| `exercise_id` | uuid FK → `exercises.id` | Exercício |
| `peso`, `series`, `repeticoes` | numeric/integer | Execução real |
| `ordem` | integer | Ordem na sessão |
| `concluido` | boolean | Marcação visual de concluído |
| `observacoes` | text | |

---

## Hidratação

### `water_goals`
`user_id` PK/FK, `meta_ml` (default 3000), `updated_at`.

### `water_logs`
`id` PK, `user_id` FK, `data` (date), `quantidade_ml` (integer), `created_at`. Soma por dia = consumo.

### `water_reminders`
`user_id` PK/FK, `ativo` boolean, `horarios` text[] (`HH:MM`), timestamps. Lida pelo cliente e enviada ao service worker para agendamento.

---

## Evolução física

### `progress_photos`
| Coluna | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid **PK** | |
| `user_id` | uuid FK → `auth.users.id` | Dono |
| `data` | date | Data do registro |
| `categoria` | text | `frente`, `lado`, `costas` |
| `storage_path` | text | Caminho no bucket `progress-photos` (`{user_id}/{uuid}.ext`) |
| `peso_kg` | numeric | Peso do dia — alimenta o gráfico de evolução |
| `observacoes` | text | Notas |

Storage: bucket **privado** `progress-photos`; a UI gera URLs assinadas (1h).

---

## Relacionamentos (resumo)

```
auth.users 1─1 profiles
auth.users 1─1 nutrition_goals
auth.users 1─N meals 1─N meal_foods N─1 foods
auth.users 1─N foods (personalizados)
auth.users 1─N workout_templates 1─N template_exercises N─1 exercises
auth.users 1─N weekly_plans 1─N weekly_plan_days N─1 workout_templates
auth.users 1─N workouts 1─N workout_exercises N─1 exercises
auth.users 1─1 water_goals / water_reminders
auth.users 1─N water_logs
auth.users 1─N progress_photos
exercise_categories 1─N exercises
```

## Triggers e funções

- `handle_new_user()` (AFTER INSERT em `auth.users`): cria `profiles` e `nutrition_goals` do novo usuário.
- `update_updated_at_column()`: atualiza `updated_at` em todas as tabelas que possuem a coluna.

## Índices importantes

Além das PKs, os filtros mais usados são `user_id`, `data` e as FKs (`meal_id`, `template_id`, `workout_id`), indexadas pelas constraints de chave estrangeira/único. Consultas sempre filtram por usuário (garantido também por RLS).
