
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS finalizado_em timestamptz;
ALTER TABLE public.workout_exercises ADD COLUMN IF NOT EXISTS concluido boolean NOT NULL DEFAULT false;
