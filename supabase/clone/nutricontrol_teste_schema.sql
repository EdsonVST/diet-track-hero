-- NutriControl_teste — script de clonagem de ESTRUTURA.
-- Gerado a partir de supabase/migrations (histórico oficial), sem alterá-las.
-- Executar no SQL Editor do NOVO projeto Supabase (NutriControl_teste), na ordem abaixo.
-- NÃO executar no projeto oficial.

-- ==================== 20260622152535_08f9d564-417d-47d8-bc15-ff4eeb97ad44.sql ====================

-- ====== ENUMS ======
CREATE TYPE public.goal_type AS ENUM ('emagrecimento', 'manutencao', 'ganho_massa');
CREATE TYPE public.meal_type AS ENUM ('cafe_da_manha', 'almoco', 'lanche', 'jantar', 'outro');

-- ====== TRIGGER FUNCTION (updated_at) ======
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ====== PROFILES ======
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  peso NUMERIC(5,2),
  altura NUMERIC(5,2),
  idade INTEGER,
  objetivo public.goal_type DEFAULT 'manutencao',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== NUTRITION GOALS ======
CREATE TABLE public.nutrition_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calorias NUMERIC(7,2) NOT NULL DEFAULT 2000,
  proteinas NUMERIC(6,2) NOT NULL DEFAULT 120,
  carboidratos NUMERIC(6,2) NOT NULL DEFAULT 250,
  gorduras NUMERIC(6,2) NOT NULL DEFAULT 65,
  fibras NUMERIC(6,2) NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_goals TO authenticated;
GRANT ALL ON public.nutrition_goals TO service_role;
ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals all" ON public.nutrition_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER nutrition_goals_updated_at BEFORE UPDATE ON public.nutrition_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== FOODS (nutrients are per 100g/100ml) ======
CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = pertence à TACO (público)
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade_base TEXT NOT NULL DEFAULT 'g', -- g | ml | un
  energia_kcal NUMERIC(7,2) NOT NULL DEFAULT 0,
  proteina NUMERIC(7,2) NOT NULL DEFAULT 0,
  carboidrato NUMERIC(7,2) NOT NULL DEFAULT 0,
  gordura NUMERIC(7,2) NOT NULL DEFAULT 0,
  fibra NUMERIC(7,2) NOT NULL DEFAULT 0,
  sodio NUMERIC(7,2) NOT NULL DEFAULT 0,
  minerais JSONB DEFAULT '{}'::jsonb,
  vitaminas JSONB DEFAULT '{}'::jsonb,
  fonte TEXT NOT NULL DEFAULT 'taco', -- taco | usuario
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX foods_nome_idx ON public.foods USING gin (to_tsvector('portuguese', nome));
CREATE INDEX foods_nome_trgm_idx ON public.foods (lower(nome));
CREATE INDEX foods_user_idx ON public.foods (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foods TO authenticated;
GRANT ALL ON public.foods TO service_role;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
-- todos autenticados leem TACO + seus próprios
CREATE POLICY "foods read" ON public.foods FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "foods insert own" ON public.foods FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "foods update own" ON public.foods FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "foods delete own" ON public.foods FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER foods_updated_at BEFORE UPDATE ON public.foods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== MEALS ======
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  horario TIME,
  tipo public.meal_type NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meals_user_data_idx ON public.meals (user_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals TO authenticated;
GRANT ALL ON public.meals TO service_role;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meals own all" ON public.meals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER meals_updated_at BEFORE UPDATE ON public.meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== MEAL_FOODS ======
CREATE TABLE public.meal_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  quantidade NUMERIC(8,2) NOT NULL, -- na unidade_base do alimento
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meal_foods_meal_idx ON public.meal_foods (meal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_foods TO authenticated;
GRANT ALL ON public.meal_foods TO service_role;
ALTER TABLE public.meal_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_foods read own" ON public.meal_foods FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "meal_foods insert own" ON public.meal_foods FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "meal_foods update own" ON public.meal_foods FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "meal_foods delete own" ON public.meal_foods FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));

-- ====== AUTO CREATE PROFILE + GOALS ON SIGNUP ======
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)));
  INSERT INTO public.nutrition_goals (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== 20260622152629_291b9265-2d15-44ee-ba91-7a2fb7a61ac0.sql ====================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ==================== 20260623145832_5fe330e1-1b32-473e-a51f-5ea5f2339bc8.sql ====================

-- 1. Expand foods with vitamins and minerals
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS vit_a numeric,
  ADD COLUMN IF NOT EXISTS vit_b1 numeric,
  ADD COLUMN IF NOT EXISTS vit_b2 numeric,
  ADD COLUMN IF NOT EXISTS vit_b3 numeric,
  ADD COLUMN IF NOT EXISTS vit_b5 numeric,
  ADD COLUMN IF NOT EXISTS vit_b6 numeric,
  ADD COLUMN IF NOT EXISTS vit_b7 numeric,
  ADD COLUMN IF NOT EXISTS vit_b9 numeric,
  ADD COLUMN IF NOT EXISTS vit_b12 numeric,
  ADD COLUMN IF NOT EXISTS vit_c numeric,
  ADD COLUMN IF NOT EXISTS vit_d numeric,
  ADD COLUMN IF NOT EXISTS vit_e numeric,
  ADD COLUMN IF NOT EXISTS vit_k numeric,
  ADD COLUMN IF NOT EXISTS calcio numeric,
  ADD COLUMN IF NOT EXISTS ferro numeric,
  ADD COLUMN IF NOT EXISTS magnesio numeric,
  ADD COLUMN IF NOT EXISTS fosforo numeric,
  ADD COLUMN IF NOT EXISTS potassio numeric,
  ADD COLUMN IF NOT EXISTS zinco numeric,
  ADD COLUMN IF NOT EXISTS selenio numeric;

-- 2. Exercise categories
CREATE TABLE IF NOT EXISTS public.exercise_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercise_categories TO authenticated;
GRANT ALL ON public.exercise_categories TO service_role;
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories readable by authenticated"
  ON public.exercise_categories FOR SELECT TO authenticated USING (true);

-- 3. Exercises
CREATE TABLE IF NOT EXISTS public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria_id uuid REFERENCES public.exercise_categories(id) ON DELETE SET NULL,
  grupo_muscular text,
  descricao text,
  equipamento text,
  ativo boolean NOT NULL DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  fonte text NOT NULL DEFAULT 'sistema',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exercises visible to authenticated" ON public.exercises
  FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users insert own exercises" ON public.exercises
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own exercises" ON public.exercises
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own exercises" ON public.exercises
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Workouts
CREATE TABLE IF NOT EXISTS public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horario time,
  duracao_min integer,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own workouts" ON public.workouts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Workout exercises
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  peso numeric,
  series integer,
  repeticoes integer,
  observacoes text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own workout exercises" ON public.workout_exercises
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));

-- 6. Seed categories + exercises
INSERT INTO public.exercise_categories (nome, descricao) VALUES
  ('Peito', 'Exercícios para peitoral'),
  ('Costas', 'Exercícios para dorsais'),
  ('Pernas', 'Exercícios para membros inferiores'),
  ('Cardio', 'Exercícios cardiovasculares')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.exercises (nome, categoria_id, grupo_muscular, equipamento, fonte)
SELECT v.nome, c.id, v.grupo, v.equip, 'sistema'
FROM (VALUES
  ('Supino reto', 'Peito', 'Peitoral', 'Barra'),
  ('Supino inclinado', 'Peito', 'Peitoral superior', 'Barra'),
  ('Crucifixo', 'Peito', 'Peitoral', 'Halteres'),
  ('Puxada frontal', 'Costas', 'Latíssimo', 'Polia'),
  ('Remada baixa', 'Costas', 'Dorsais', 'Polia'),
  ('Remada curvada', 'Costas', 'Dorsais', 'Barra'),
  ('Agachamento', 'Pernas', 'Quadríceps', 'Barra'),
  ('Leg Press', 'Pernas', 'Quadríceps', 'Máquina'),
  ('Mesa flexora', 'Pernas', 'Posterior', 'Máquina'),
  ('Esteira', 'Cardio', 'Cardio', 'Esteira'),
  ('Bicicleta', 'Cardio', 'Cardio', 'Bicicleta'),
  ('Elíptico', 'Cardio', 'Cardio', 'Elíptico')
) AS v(nome, categoria, grupo, equip)
JOIN public.exercise_categories c ON c.nome = v.categoria
WHERE NOT EXISTS (SELECT 1 FROM public.exercises e WHERE e.nome = v.nome AND e.fonte = 'sistema');

-- ==================== 20260624124908_d30f9228-194b-4e06-a683-46d2f87dd036.sql ====================

CREATE TABLE public.workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  objetivo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_templates TO authenticated;
GRANT ALL ON public.workout_templates TO service_role;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own templates" ON public.workout_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_workout_templates_updated BEFORE UPDATE ON public.workout_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,
  series INT NOT NULL DEFAULT 3,
  repeticoes TEXT NOT NULL DEFAULT '10',
  descanso_segundos INT NOT NULL DEFAULT 60,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_exercises TO authenticated;
GRANT ALL ON public.template_exercises TO service_role;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own template exercises" ON public.template_exercises FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND t.user_id = auth.uid()));

CREATE TABLE public.weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_plans TO authenticated;
GRANT ALL ON public.weekly_plans TO service_role;
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plans" ON public.weekly_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_weekly_plans_updated BEFORE UPDATE ON public.weekly_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.weekly_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.weekly_plans(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  template_id UUID REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  rotulo TEXT,
  UNIQUE(plan_id, dia_semana)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_plan_days TO authenticated;
GRANT ALL ON public.weekly_plan_days TO service_role;
ALTER TABLE public.weekly_plan_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan days" ON public.weekly_plan_days FOR ALL
  USING (EXISTS (SELECT 1 FROM public.weekly_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.weekly_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));

CREATE TABLE public.water_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_ml INT NOT NULL DEFAULT 3000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_goals TO authenticated;
GRANT ALL ON public.water_goals TO service_role;
ALTER TABLE public.water_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own water goal" ON public.water_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_water_goals_updated BEFORE UPDATE ON public.water_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.water_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  quantidade_ml INT NOT NULL CHECK (quantidade_ml > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_water_logs_user_date ON public.water_logs(user_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_logs TO authenticated;
GRANT ALL ON public.water_logs TO service_role;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own water logs" ON public.water_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL CHECK (categoria IN ('frente','lado','costas')),
  storage_path TEXT NOT NULL,
  peso_kg NUMERIC(5,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_progress_photos_user_date ON public.progress_photos(user_id, data DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_photos TO authenticated;
GRANT ALL ON public.progress_photos TO service_role;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress photos" ON public.progress_photos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON public.exercises;
CREATE POLICY "Authenticated can update exercises" ON public.exercises FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete own exercises" ON public.exercises FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users read own progress photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users upload own progress photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users update own progress photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users delete own progress photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ==================== 20260721145013_e5d4b3c5-1a25-4c56-8035-4054581a2250.sql ====================

ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS finalizado_em timestamptz;
ALTER TABLE public.workout_exercises ADD COLUMN IF NOT EXISTS concluido boolean NOT NULL DEFAULT false;

-- ==================== 20260728181758_d184356a-5c3d-404e-bdff-aaf3daebddf0.sql ====================
CREATE TABLE IF NOT EXISTS public.water_reminders (
  user_id uuid PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  horarios text[] NOT NULL DEFAULT ARRAY['08:00','10:00','12:00','14:00','16:00','18:00','20:00'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_reminders TO authenticated;
GRANT ALL ON public.water_reminders TO service_role;

ALTER TABLE public.water_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own water reminders" ON public.water_reminders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_water_reminders_updated_at
  BEFORE UPDATE ON public.water_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.exercise_categories (nome, descricao)
SELECT v.nome, v.descricao FROM (VALUES
  ('Ombros','Deltoides e trapézio'),
  ('Bíceps','Flexores do braço'),
  ('Tríceps','Extensores do braço'),
  ('Abdômen','Core e abdominais')
) AS v(nome, descricao)
WHERE NOT EXISTS (SELECT 1 FROM public.exercise_categories c WHERE c.nome = v.nome);

WITH lib(nome, categoria, grupo, equipamento, descricao) AS (VALUES
('Supino reto barra','Peito','Peitoral','Barra','Deitado no banco reto, desça a barra até o peito e empurre até estender os cotovelos.'),
('Supino reto halteres','Peito','Peitoral','Halteres','No banco reto, desça os halteres ao lado do peito e empurre para cima unindo levemente.'),
('Supino inclinado barra','Peito','Peitoral superior','Barra','Banco inclinado 30-45°, desça a barra na linha da clavícula e empurre.'),
('Supino inclinado halteres','Peito','Peitoral superior','Halteres','Banco inclinado, desça os halteres controladamente e empurre até quase estender.'),
('Supino declinado','Peito','Peitoral inferior','Barra','Banco declinado, desça a barra na parte baixa do peito e empurre.'),
('Crucifixo reto','Peito','Peitoral','Halteres','Banco reto, abra os braços semi-flexionados e volte contraindo o peito.'),
('Crucifixo inclinado','Peito','Peitoral superior','Halteres','Banco inclinado, abertura ampla dos braços com cotovelos levemente flexionados.'),
('Crucifixo máquina','Peito','Peitoral','Máquina','Sentado na máquina, junte os braços à frente contraindo o peitoral.'),
('Peck Deck','Peito','Peitoral','Máquina','Antebraços apoiados nas almofadas, aproxime os cotovelos à frente do peito.'),
('Crossover alto','Peito','Peitoral inferior','Cabo','Polias altas, cruze os cabos para baixo à frente do corpo.'),
('Crossover médio','Peito','Peitoral','Cabo','Polias na altura do ombro, junte as mãos à frente do peito.'),
('Crossover baixo','Peito','Peitoral superior','Cabo','Polias baixas, eleve os cabos até a altura do peito.'),
('Flexão de braço','Peito','Peitoral','Peso corporal','Corpo alinhado, desça o peito até próximo ao chão e empurre.'),
('Flexão inclinada','Peito','Peitoral inferior','Peso corporal','Mãos apoiadas em banco, execute a flexão com menor carga.'),
('Flexão declinada','Peito','Peitoral superior','Peso corporal','Pés elevados em banco, execute a flexão aumentando a exigência.'),
('Paralelas para peito','Peito','Peitoral inferior','Peso corporal','Tronco inclinado à frente nas barras paralelas, desça e suba.'),
('Puxada frente aberta','Costas','Latíssimo','Máquina','Pegada aberta pronada, puxe a barra até a parte alta do peito.'),
('Puxada frente fechada','Costas','Dorsais','Máquina','Pegada fechada neutra, puxe o triângulo até o peito.'),
('Puxada supinada','Costas','Dorsais','Máquina','Pegada supinada na largura dos ombros, puxe até o peito.'),
('Barra fixa','Costas','Latíssimo','Peso corporal','Pegada pronada, puxe o corpo até o queixo passar a barra.'),
('Barra fixa supinada','Costas','Dorsais','Peso corporal','Pegada supinada, puxe o corpo enfatizando dorsais e bíceps.'),
('Remada baixa','Costas','Dorsais','Máquina','Sentado, puxe o triângulo até o abdômen mantendo o tronco ereto.'),
('Remada curvada barra','Costas','Dorsais','Barra','Tronco inclinado, puxe a barra até o abdômen com coluna neutra.'),
('Remada unilateral halter','Costas','Dorsais','Halteres','Apoiado no banco, puxe o halter até o quadril.'),
('Remada cavalinho','Costas','Dorsais','Barra','Barra em T, puxe até o tronco mantendo as costas retas.'),
('Pullover','Costas','Latíssimo','Halteres','Deitado, leve o halter atrás da cabeça e retorne contraindo as costas.'),
('Remada máquina','Costas','Dorsais','Máquina','Peito apoiado, puxe as alavancas até a linha do tronco.'),
('Pulldown','Costas','Latíssimo','Cabo','Braços estendidos, empurre a barra para baixo até as coxas.'),
('Desenvolvimento barra','Ombros','Deltoide anterior','Barra','Sentado ou em pé, empurre a barra acima da cabeça.'),
('Desenvolvimento halteres','Ombros','Deltoide anterior','Halteres','Empurre os halteres acima da cabeça sem travar os cotovelos.'),
('Desenvolvimento máquina','Ombros','Deltoide anterior','Máquina','Sentado, empurre as alavancas acima da cabeça.'),
('Elevação lateral','Ombros','Deltoide medial','Halteres','Eleve os braços lateralmente até a altura dos ombros.'),
('Elevação frontal','Ombros','Deltoide anterior','Halteres','Eleve os braços à frente até a altura dos ombros.'),
('Crucifixo inverso','Ombros','Deltoide posterior','Halteres','Tronco inclinado, abra os braços para trás contraindo o posterior.'),
('Face Pull','Ombros','Deltoide posterior','Cabo','Puxe a corda em direção ao rosto abrindo os cotovelos.'),
('Arnold Press','Ombros','Deltoide anterior','Halteres','Rotacione os halteres da posição supinada para pronada ao empurrar.'),
('Remada alta','Ombros','Trapézio','Barra','Puxe a barra próxima ao corpo até a altura do peito.'),
('Rosca direta barra','Bíceps','Bíceps','Barra','Cotovelos junto ao corpo, flexione a barra até a altura do peito.'),
('Rosca direta W','Bíceps','Bíceps','Barra W','Mesma execução da rosca direta com barra W para menor estresse no punho.'),
('Rosca alternada','Bíceps','Bíceps','Halteres','Flexione um braço por vez com leve supinação.'),
('Rosca martelo','Bíceps','Braquial','Halteres','Pegada neutra, flexione mantendo os polegares para cima.'),
('Rosca concentrada','Bíceps','Bíceps','Halteres','Sentado, cotovelo apoiado na coxa, flexione até contrair.'),
('Rosca Scott','Bíceps','Bíceps','Barra W','Braços apoiados no banco Scott, flexione controladamente.'),
('Rosca banco inclinado','Bíceps','Bíceps','Halteres','Deitado em banco inclinado, flexione com os braços pendendo.'),
('Rosca cabo','Bíceps','Bíceps','Cabo','Na polia baixa, flexione mantendo tensão constante.'),
('Tríceps pulley','Tríceps','Tríceps','Cabo','Cotovelos fixos, estenda a barra para baixo.'),
('Tríceps corda','Tríceps','Tríceps','Cabo','Estenda a corda para baixo abrindo as pontas no final.'),
('Tríceps francês','Tríceps','Tríceps','Halteres','Halter acima da cabeça, flexione e estenda os cotovelos.'),
('Tríceps testa','Tríceps','Tríceps','Barra W','Deitado, desça a barra até a testa e estenda os cotovelos.'),
('Tríceps banco','Tríceps','Tríceps','Peso corporal','Mãos no banco atrás do corpo, desça e suba o quadril.'),
('Tríceps coice','Tríceps','Tríceps','Halteres','Tronco inclinado, estenda o cotovelo para trás.'),
('Mergulho nas paralelas','Tríceps','Tríceps','Peso corporal','Tronco ereto nas paralelas, desça e empurre estendendo os cotovelos.'),
('Agachamento livre','Pernas','Quadríceps','Barra','Barra nas costas, desça até a coxa paralela e suba.'),
('Agachamento frontal','Pernas','Quadríceps','Barra','Barra à frente dos ombros, agache mantendo o tronco ereto.'),
('Leg Press 45°','Pernas','Quadríceps','Máquina','Empurre a plataforma sem travar os joelhos.'),
('Leg Press horizontal','Pernas','Quadríceps','Máquina','Sentado, empurre a plataforma controlando a descida.'),
('Hack Machine','Pernas','Quadríceps','Máquina','Costas apoiadas, agache na máquina hack e retorne.'),
('Cadeira extensora','Pernas','Quadríceps','Máquina','Estenda os joelhos contraindo o quadríceps no topo.'),
('Afundo','Pernas','Quadríceps','Halteres','Passo à frente, desça o joelho de trás e retorne.'),
('Passada','Pernas','Quadríceps','Halteres','Caminhe alternando passadas longas com descida controlada.'),
('Bulgarian Split Squat','Pernas','Quadríceps','Halteres','Pé traseiro no banco, agache com a perna da frente.'),
('Mesa flexora deitada','Pernas','Posterior','Máquina','Deitado, flexione os joelhos trazendo o rolo aos glúteos.'),
('Cadeira flexora','Pernas','Posterior','Máquina','Sentado, flexione os joelhos contra a resistência.'),
('Stiff','Pernas','Posterior','Barra','Joelhos semi-flexionados, desça a barra rente às pernas.'),
('Levantamento terra romeno','Pernas','Posterior','Barra','Quadril para trás, desça a barra até o meio da canela.'),
('Good Morning','Pernas','Posterior','Barra','Barra nas costas, incline o tronco à frente com coluna neutra.'),
('Elevação pélvica','Pernas','Glúteos','Barra','Costas no banco, eleve o quadril contraindo os glúteos.'),
('Glúteo máquina','Pernas','Glúteos','Máquina','Empurre a plataforma para trás com a perna estendendo o quadril.'),
('Coice no cabo','Pernas','Glúteos','Cabo','Tornozeleira na polia baixa, estenda a perna para trás.'),
('Abdução máquina','Pernas','Glúteos','Máquina','Sentado, afaste os joelhos contra a resistência.'),
('Panturrilha em pé','Pernas','Panturrilha','Máquina','Eleve os calcanhares ao máximo e desça alongando.'),
('Panturrilha sentado','Pernas','Panturrilha','Máquina','Sentado, eleve os calcanhares enfatizando o sóleo.'),
('Panturrilha Leg Press','Pernas','Panturrilha','Máquina','Na plataforma do leg press, empurre com a ponta dos pés.'),
('Abdominal reto','Abdômen','Abdômen','Peso corporal','Deitado, eleve o tronco contraindo o abdômen.'),
('Abdominal infra','Abdômen','Abdômen inferior','Peso corporal','Eleve o quadril trazendo os joelhos ao peito.'),
('Abdominal oblíquo','Abdômen','Oblíquos','Peso corporal','Eleve o tronco em rotação levando o cotovelo ao joelho oposto.'),
('Prancha','Abdômen','Core','Peso corporal','Apoio nos antebraços, mantenha o corpo alinhado e isométrico.'),
('Prancha lateral','Abdômen','Oblíquos','Peso corporal','Apoio lateral em um antebraço, quadril elevado e alinhado.'),
('Elevação de pernas','Abdômen','Abdômen inferior','Peso corporal','Pendurado ou deitado, eleve as pernas estendidas.'),
('Abdominal máquina','Abdômen','Abdômen','Máquina','Sentado, flexione o tronco contra a resistência.'),
('Crunch cabo','Abdômen','Abdômen','Cabo','Ajoelhado na polia alta, flexione o tronco puxando a corda.'),
('Caminhada','Cardio','Cardio','Esteira','Caminhada em ritmo constante, com ou sem inclinação.'),
('Corrida','Cardio','Cardio','Esteira','Corrida contínua ou intervalada em ritmo controlado.'),
('Escada','Cardio','Cardio','Máquina','Subida contínua no simulador de escada.'),
('Remo','Cardio','Cardio','Remo ergômetro','Puxada coordenada de pernas, tronco e braços.'),
('Pular corda','Cardio','Cardio','Corda','Saltos contínuos com corda em ritmo constante.')
)
INSERT INTO public.exercises (nome, categoria_id, grupo_muscular, equipamento, descricao, fonte, user_id, ativo)
SELECT lib.nome, c.id, lib.grupo, lib.equipamento, lib.descricao, 'sistema', NULL, true
FROM lib
JOIN public.exercise_categories c ON c.nome = lib.categoria
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises e WHERE lower(e.nome) = lower(lib.nome) AND e.user_id IS NULL
);
-- ==================== 20260804181353_5cce9c9b-45b5-43e5-a485-502b95bd5949.sql ====================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS peso_meta numeric;
-- ==================== 20260806151835_d9dac458-f6b5-4b80-83ea-7ea7d1ad53dc.sql ====================
-- Roles
CREATE TYPE public.app_role AS ENUM ('master', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'));

-- Account status on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz,
  ADD COLUMN IF NOT EXISTS desativado_em timestamptz;

-- Admin audit logs
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_email text,
  target_user_id uuid,
  target_email text,
  acao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "masters read audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master'));

CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);

-- ==================== 20260806151937_e0cdb739-0c20-4652-ba31-b5eb8f07ede2.sql ====================
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
-- ==================== 20260807181340_8a8efdbd-ea0e-41cf-9a62-e5f02f179a9c.sql ====================
-- 1. Leitura administrativa (Master) somente-leitura
CREATE POLICY "Master pode ver todos os perfis leitura" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver metas" ON public.nutrition_goals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver refeicoes" ON public.meals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver itens de refeicao" ON public.meal_foods FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver alimentos" ON public.foods FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver exercicios" ON public.exercises FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver treinos" ON public.workouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver exercicios do treino" ON public.workout_exercises FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver modelos" ON public.workout_templates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver exercicios do modelo" ON public.template_exercises FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver planos semanais" ON public.weekly_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver dias do plano" ON public.weekly_plan_days FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver metas de agua" ON public.water_goals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver registros de agua" ON public.water_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver lembretes de agua" ON public.water_reminders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));
CREATE POLICY "Master pode ver fotos de progresso" ON public.progress_photos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- Storage: administradores podem ler as fotos de evolução
CREATE POLICY "Master le fotos de progresso" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'progress-photos' AND public.has_role(auth.uid(), 'master'));

-- 2. Modelos de treino padrão
CREATE OR REPLACE FUNCTION public.seed_default_workout_templates(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing integer;
  v_tpl uuid;
  v_created integer := 0;
  v_specs jsonb := '[
    {"nome":"Peito","objetivo":"Hipertrofia","descricao":"Modelo padrão de peito para iniciantes e intermediários.","exs":["Supino reto barra","Supino inclinado halteres","Crucifixo máquina","Crossover médio","Flexão de braço"]},
    {"nome":"Costas","objetivo":"Hipertrofia","descricao":"Modelo padrão de costas com puxadas e remadas.","exs":["Puxada frontal","Remada curvada barra","Remada baixa","Remada unilateral halter","Pullover"]},
    {"nome":"Perna","objetivo":"Hipertrofia","descricao":"Modelo padrão de pernas cobrindo quadríceps, posterior e panturrilha.","exs":["Agachamento livre","Leg Press 45°","Cadeira extensora","Mesa flexora","Panturrilha em pé"]}
  ]'::jsonb;
  v_spec jsonb;
  v_ex text;
  v_ex_id uuid;
  v_ordem integer;
BEGIN
  SELECT count(*) INTO v_existing FROM public.workout_templates WHERE user_id = _user_id;
  IF v_existing > 0 THEN RETURN 0; END IF;

  FOR v_spec IN SELECT * FROM jsonb_array_elements(v_specs) LOOP
    INSERT INTO public.workout_templates (user_id, nome, descricao, objetivo, ativo)
    VALUES (_user_id, v_spec->>'nome', v_spec->>'descricao', v_spec->>'objetivo', true)
    RETURNING id INTO v_tpl;
    v_created := v_created + 1;
    v_ordem := 0;
    FOR v_ex IN SELECT jsonb_array_elements_text(v_spec->'exs') LOOP
      SELECT id INTO v_ex_id FROM public.exercises
        WHERE nome = v_ex AND user_id IS NULL AND ativo = true
        ORDER BY created_at LIMIT 1;
      IF v_ex_id IS NOT NULL THEN
        INSERT INTO public.template_exercises (template_id, exercise_id, ordem, series, repeticoes, descanso_segundos)
        VALUES (v_tpl, v_ex_id, v_ordem, 4, '10', 60);
        v_ordem := v_ordem + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_workout_templates(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.seed_my_default_workout_templates()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.seed_default_workout_templates(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.seed_my_default_workout_templates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_my_default_workout_templates() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)));
  INSERT INTO public.nutrition_goals (user_id) VALUES (NEW.id);
  PERFORM public.seed_default_workout_templates(NEW.id);
  RETURN NEW;
END;
$$;
