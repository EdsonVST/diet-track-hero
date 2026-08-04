# Organização do Projeto

## Convenções de nomenclatura

- **Arquivos**: `kebab-case` (`water-reminders-card.tsx`, `historico-treinos.tsx`).
- **Rotas**: nome do arquivo = caminho da URL, em português (`/modelos-treino`, `/evolucao-fisica`).
- **Componentes React**: `PascalCase` (`WaterRemindersCard`).
- **Hooks**: prefixo `use` (`useWaterReminderScheduler`).
- **Colunas e tabelas do banco**: `snake_case` em português (`peso_meta`, `template_exercises`).
- **Query keys**: array com domínio + escopo (`["template_exercises", templateId]`, `["meals", data]`).
- **Textos de UI**: português (pt-BR); mensagens de feedback via `toast` do sonner.

## Padrão de componentes

- Telas ficam na rota; componentes auxiliares pequenos podem viver no mesmo arquivo (ex.: `SortableExercise`, `WeightChartCard`) e são extraídos para `src/components/` quando reutilizados.
- Primitivos visuais vêm de `src/components/ui` (shadcn). Não colocar regra de negócio ali.
- **Cores sempre por tokens semânticos** (`bg-primary`, `text-muted-foreground`, `hsl(var(--primary))`). Nunca `text-white`, `bg-black` ou hex fixo — quebra tema/dark mode.
- Layout responsivo mobile-first (`grid-cols-2 sm:grid-cols-4`, alturas fluidas nos gráficos).

## Organização das rotas

```
src/routes/
├── __root.tsx              layout raiz, head/SEO, providers, erro/404
├── index.tsx               landing pública
├── auth.tsx                login/cadastro (pública)
└── _authenticated/
    ├── route.tsx           gate de auth (ssr:false) + sidebar + scheduler
    └── <feature>.tsx       telas protegidas
```

- Rota nova protegida → criar arquivo dentro de `_authenticated/`.
- Rota pública com dados → SSR habilitado, sem `beforeLoad` de auth.
- `src/routeTree.gen.ts` é gerado — **não editar**.

## Chamadas de dados (camada "services")

- Leituras/escritas do usuário: `supabase` de `@/integrations/supabase/client`, dentro de `useQuery`/`useMutation`.
- Padrão de mutação: `useMutation` → `onSuccess: invalidateQueries(<key>)` → `toast`.
- Exceção: reordenação por drag & drop usa `setQueryData` (atualização otimista) **sem** invalidate no sucesso, para não sobrescrever a ordem recém-definida.
- Lógica que exigir segredo/servidor: `createServerFn` em `src/lib/*.functions.ts` (nunca Supabase Edge Functions neste stack).
- `client.server.ts` (service role) é exclusivo de servidor e nunca importado por componente.

## Fluxo de autenticação

1. Usuário entra em `/auth` e autentica com email/senha (Supabase Auth).
2. A sessão é persistida no navegador pelo `supabase-js`.
3. `_authenticated/route.tsx` valida a sessão antes de renderizar a subárvore protegida.
4. Toda consulta ao banco carrega o JWT do usuário; o **RLS** garante o isolamento por `auth.uid()`.
5. Logout limpa a sessão e o gate redireciona para `/auth`.

## Fluxo de persistência dos dados

```
Componente → useMutation → supabase-js (INSERT/UPDATE/DELETE)
   → Postgres (RLS + triggers updated_at)
   → invalidateQueries → refetch → UI atualizada
```

- Arquivos (fotos) vão para o Storage privado e apenas o `storage_path` é gravado na tabela.
- Alterações de schema sempre por **migration** versionada em `supabase/migrations/`.

## Manutenção da documentação

Ao implementar uma funcionalidade nova:

1. Atualizar `docs/fluxos-funcionalidades.md` com telas/tabelas envolvidas.
2. Atualizar `docs/banco-de-dados.md` se houver mudança de schema.
3. Atualizar `docs/estrutura-do-codigo.md` se novos arquivos/pastas relevantes forem criados.
4. Ajustar `docs/diagramas.md` quando o fluxo mudar.
