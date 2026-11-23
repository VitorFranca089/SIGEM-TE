-- Migracao do RF03: cursos, turmas, solicitacoes e matriculas.
--
-- O schema.sql ja cria estas colunas para bancos novos. Este arquivo e para
-- bancos que nasceram antes do RF03, quando curso e turma ainda nao tinham
-- estado de ativo, status de solicitacao ou solicitante.
--
-- Pode ser executado mais de uma vez. Tudo roda numa transacao para que o banco
-- nao fique parcialmente migrado se alguma regra encontrar dados invalidos.

BEGIN;

ALTER TABLE curso
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE turma
  ADD COLUMN IF NOT EXISTS solicitante_id INTEGER REFERENCES professor(id),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- Bancos antigos podem ter recebido a coluna sem a restricao durante uma
-- tentativa anterior. Remover e recriar pelo nome conhecido torna a migracao
-- repetivel sem criar regras duplicadas.
ALTER TABLE turma DROP CONSTRAINT IF EXISTS turma_status_check;
ALTER TABLE turma
  ADD CONSTRAINT turma_status_check
  CHECK (status IN ('solicitada', 'ativa', 'recusada', 'encerrada'));

CREATE INDEX IF NOT EXISTS turma_professor_ativo_idx
  ON turma (professor_id, ativo, dia_semana, hora_inicio);

CREATE INDEX IF NOT EXISTS turma_curso_ativo_idx
  ON turma (curso_id, ativo);

CREATE INDEX IF NOT EXISTS matricula_aluno_idx
  ON matricula (aluno_id);

COMMIT;
