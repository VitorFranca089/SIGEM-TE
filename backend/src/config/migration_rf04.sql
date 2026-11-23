-- Migracao do RF04: agenda de aulas regulares e grupos extracurriculares.
-- Pode ser executada em bancos que ja possuem o RF03. Nao apaga historico.

BEGIN;

CREATE TABLE IF NOT EXISTS grupo (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  professor_id INTEGER REFERENCES professor(id),
  criado_por INTEGER NOT NULL REFERENCES usuario(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grupo_membro (
  grupo_id INTEGER NOT NULL REFERENCES grupo(id),
  aluno_id INTEGER NOT NULL REFERENCES aluno(id),
  PRIMARY KEY (grupo_id, aluno_id)
);

ALTER TABLE aula
  ALTER COLUMN turma_id DROP NOT NULL;

ALTER TABLE aula
  ADD COLUMN IF NOT EXISTS grupo_id INTEGER REFERENCES grupo(id),
  ADD COLUMN IF NOT EXISTS responsavel_id INTEGER REFERENCES professor(id),
  ADD COLUMN IF NOT EXISTS criado_por INTEGER REFERENCES usuario(id),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'agendada',
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelada_por INTEGER REFERENCES usuario(id),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento VARCHAR(500);

-- Registros antigos vieram apenas de turmas e nao tinham responsavel nem
-- status. Preenchemos o responsavel pelo professor da turma e deixamos os
-- demais campos com valores seguros para preservar o historico.
UPDATE aula a
SET responsavel_id = t.professor_id
FROM turma t
WHERE a.turma_id = t.id AND a.responsavel_id IS NULL;

UPDATE aula
SET status = 'agendada'
WHERE status IS NULL;

-- Bancos antigos do RF03 nao tinham criado_por. As aulas existentes sao dados
-- de teste/historico, mas continuam precisando de um autor para que a regra do
-- banco seja a mesma de um banco novo. Usamos um administrador ativo como
-- responsavel tecnico apenas quando o campo ainda esta vazio.
DO $$
DECLARE
  administrador_id INTEGER;
BEGIN
  SELECT id INTO administrador_id
  FROM usuario
  WHERE perfil = 'admin' AND ativo = true
  ORDER BY id
  LIMIT 1;

  IF administrador_id IS NULL
     AND EXISTS (SELECT 1 FROM aula WHERE criado_por IS NULL) THEN
    RAISE EXCEPTION 'Nao ha administrador ativo para preencher criado_por das aulas antigas';
  END IF;

  UPDATE aula
  SET criado_por = administrador_id
  WHERE criado_por IS NULL;
END $$;

-- Horarios ausentes ou invertidos nao podem ser inventados durante a migracao.
-- O banco informa exatamente o problema para que os registros de teste sejam
-- corrigidos ou removidos antes de aplicar a regra NOT NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM aula
    WHERE hora_inicio IS NULL
       OR hora_fim IS NULL
       OR hora_inicio >= hora_fim
  ) THEN
    RAISE EXCEPTION 'Existem aulas antigas sem horario valido; corrija ou remova os dados de teste antes da migracao';
  END IF;
END $$;

ALTER TABLE aula DROP CONSTRAINT IF EXISTS aula_status_check;
ALTER TABLE aula
  ADD CONSTRAINT aula_status_check
  CHECK (status IN ('agendada', 'cancelada', 'realizada'));

ALTER TABLE aula DROP CONSTRAINT IF EXISTS aula_destino_check;
-- Em bancos novos, o schema.sql pode ter dado a mesma regra o nome automatico
-- aula_check1. Remover os dois nomes torna a migracao repetivel sem duplicar a
-- validacao de destino.
ALTER TABLE aula DROP CONSTRAINT IF EXISTS aula_check1;
ALTER TABLE aula
  ADD CONSTRAINT aula_destino_check
  CHECK ((turma_id IS NOT NULL AND grupo_id IS NULL)
      OR (turma_id IS NULL AND grupo_id IS NOT NULL));

-- O schema.sql cria estas tres colunas como obrigatorias e exige que a aula
-- comece antes de terminar. Sem isto, o banco antigo migrado aceitaria aula sem
-- horario ou sem autor, e ficaria diferente de um banco criado do zero.
-- SET NOT NULL falha se ja houver aula com o campo vazio - de proposito: com
-- ON_ERROR_STOP a migracao inteira para, em vez de esconder o dado torto.
ALTER TABLE aula
  ALTER COLUMN hora_inicio SET NOT NULL,
  ALTER COLUMN hora_fim SET NOT NULL,
  ALTER COLUMN criado_por SET NOT NULL;

-- Mesmo nome que o PostgreSQL da a esta regra no schema.sql (aula_check).
ALTER TABLE aula DROP CONSTRAINT IF EXISTS aula_check;
ALTER TABLE aula
  ADD CONSTRAINT aula_check CHECK (hora_inicio < hora_fim);

CREATE INDEX IF NOT EXISTS aula_data_idx ON aula (data, hora_inicio, status);
CREATE INDEX IF NOT EXISTS aula_turma_idx ON aula (turma_id, data);
CREATE INDEX IF NOT EXISTS aula_grupo_idx ON aula (grupo_id, data);
CREATE INDEX IF NOT EXISTS grupo_membro_aluno_idx ON grupo_membro (aluno_id, grupo_id);

COMMIT;
