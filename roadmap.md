
## Ambiente de testes independente (pedido 14/09/2026)
- Criar projeto Supabase separado `NutriControl_teste` (ação manual do usuário: um projeto Lovable aponta para um único Supabase).
- Clonar schema completo (tabelas, tipos, PK/FK, índices, constraints, defaults, triggers, funções, RLS).
- Replicar bucket `progress-photos` e policies de Storage.
- Copiar dados existentes quando possível (auth.users não é copiável entre projetos).
- Apontar APENAS a versão de teste para as novas credenciais; oficial permanece intocada.
- Relatório final com projetos, variáveis alteradas, URLs e o que não pôde ser clonado.
