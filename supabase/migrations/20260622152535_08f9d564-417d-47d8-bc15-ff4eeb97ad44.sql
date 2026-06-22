
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
