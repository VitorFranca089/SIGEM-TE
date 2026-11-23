-- Executar em bancos criados antes do suporte a recuperacao de senha.
-- psql -h localhost -U postgres -d sigem_db -f src/config/migration_recuperacao_senha.sql

CREATE TABLE IF NOT EXISTS recuperacao_senha (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id),
  codigo_hash CHAR(64) NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recuperacao_senha_usuario_idx
  ON recuperacao_senha (usuario_id, expira_em);
