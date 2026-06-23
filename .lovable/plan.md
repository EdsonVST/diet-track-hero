## Escopo da Atualização

Três grandes módulos adicionados ao NutriControl, **sem remover nada do existente**:

1. **Relatórios avançados** (com gráficos e exportação PDF/XLSX/CSV)
2. **Nutrição expandida** (vitaminas + minerais nos alimentos)
3. **Módulo de Treinos** completo (exercícios, treinos, progressão)

---

## 1. Banco de Dados (migrations aditivas)

### 1a. Expansão `foods` (colunas novas, nullable)
Vitaminas: `vit_a, vit_b1, vit_b2, vit_b3, vit_b5, vit_b6, vit_b7, vit_b9, vit_b12, vit_c, vit_d, vit_e, vit_k`
Minerais: `calcio, ferro, magnesio, fosforo, potassio, zinco, selenio` (sódio já existe)

### 1b. Novas tabelas para Treinos
- `exercise_categories` (nome, descricao)
- `exercises` (nome, categoria_id, grupo_muscular, descricao, equipamento, ativo, user_id nullable = sistema/usuário)
- `workouts` (user_id, data, horario, duracao_min, observacoes)
- `workout_exercises` (workout_id, exercise_id, peso, series, repeticoes, observacoes, ordem)

RLS: usuário só vê os próprios `workouts`/`workout_exercises`; `exercises` e `exercise_categories` legíveis por todos autenticados, edição apenas no próprio (`user_id = auth.uid()`).

Seed: categorias (Peito, Costas, Pernas, Cardio) + exercícios de exemplo listados.

---

## 2. Frontend — novas páginas

Sidebar atualizada: Dashboard · Alimentação · Alimentos · **Treinos** · **Histórico Treinos** · **Relatórios** · Perfil

### `/relatorios`
- Seletor de período (Hoje / 7d / 30d / Mês / Ano / Personalizado com date-range)
- Cards de resumo (kcal, P, C, G, Fibra)
- Análise por refeição (4 cards)
- Top 10 alimentos mais consumidos
- Gráficos de linha (Recharts) — evolução diária dos 5 macros/fibra
- Botões: Exportar PDF / XLSX / CSV
  - PDF: `jspdf` + `jspdf-autotable` com capa (nome do usuário, período, data geração)
  - XLSX: `xlsx` lib
  - CSV: gerado nativo
- Colunas exportadas: Data, Refeição, Alimento, Quantidade, Kcal, P, C, G, Fibra, Vitaminas (agregadas), Minerais (agregados)

### `/alimentos` (expansão)
- Form com abas: Macros / Vitaminas / Minerais
- Detalhe com gráfico de pizza (composição calórica P/C/G) + listagem vitaminas/minerais

### `/treinos` (cadastro de exercícios — admin do usuário)
- CRUD igual ao de Alimentos
- Filtro por grupo muscular / categoria

### `/meu-treino`
- Seleção da data
- Adicionar múltiplos exercícios com peso/séries/reps/obs
- Lista do treino do dia
- Para cada exercício: última carga e melhor carga (consulta histórico)

### `/historico-treinos`
- Painel: treinos no mês, exercícios mais executados, frequência semanal, tempo médio
- Gráficos: evolução de carga por exercício (selecionável), volume por grupo muscular, frequência semanal

---

## 3. Dependências a instalar
`recharts` (provavelmente já), `jspdf`, `jspdf-autotable`, `xlsx`, `date-fns` (provavelmente já).

---

## 4. Detalhes técnicos
- Toda lógica de cálculo nutricional reutiliza `src/lib/nutrition.ts` (expandida com micros).
- Novo `src/lib/reports.ts` com agregadores por período + exportadores.
- Tipos Supabase serão regenerados após cada migration.
- Fix paralelo do erro de hidratação na página `/auth` (usar `ClientOnly` ou remover branch SSR).

---

## Entrega
- Migrations aprovadas → seed dos exercícios → código frontend → build verde.
- Nada existente é removido; tudo é aditivo.

Posso prosseguir?