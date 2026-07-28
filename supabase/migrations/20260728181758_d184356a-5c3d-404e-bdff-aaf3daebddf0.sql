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