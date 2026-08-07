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