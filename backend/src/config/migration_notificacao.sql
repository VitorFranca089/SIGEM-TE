-- Executar em bancos criados antes do RF09 (notificacoes e registro de download).
-- psql -h localhost -U postgres -d sigem_db -v ON_ERROR_STOP=1 -f src/config/migration_notificacao.sql
--
-- So cria o que falta, e pode ser repetida: IF NOT EXISTS em tudo. As tabelas
-- sao as mesmas do schema.sql, e o banco migrado fica igual a um banco novo.

BEGIN;

CREATE TABLE IF NOT EXISTS arquivo_download (
  arquivo_id INTEGER NOT NULL REFERENCES arquivo(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id),
  baixado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (arquivo_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS notificacao (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id),
  mensagem VARCHAR(500) NOT NULL,
  arquivo_id INTEGER REFERENCES arquivo(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  criada_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notificacao_usuario_idx
  ON notificacao (usuario_id, lida, criada_em);

COMMIT;
