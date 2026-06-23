
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
