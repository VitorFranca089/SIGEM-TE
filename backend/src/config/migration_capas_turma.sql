-- Capas editaveis das turmas.
-- Execute depois do schema.sql/RF03. A migracao e idempotente.

BEGIN;

ALTER TABLE turma
  ADD COLUMN IF NOT EXISTS capa_url TEXT,
  ADD COLUMN IF NOT EXISTS capa_pos_x SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS capa_pos_y SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS capa_zoom NUMERIC(4, 2) NOT NULL DEFAULT 1.00;

ALTER TABLE turma
  DROP CONSTRAINT IF EXISTS turma_capa_pos_x_check,
  DROP CONSTRAINT IF EXISTS turma_capa_pos_y_check,
  DROP CONSTRAINT IF EXISTS turma_capa_zoom_check;

ALTER TABLE turma
  ADD CONSTRAINT turma_capa_pos_x_check CHECK (capa_pos_x BETWEEN 0 AND 100),
  ADD CONSTRAINT turma_capa_pos_y_check CHECK (capa_pos_y BETWEEN 0 AND 100),
  ADD CONSTRAINT turma_capa_zoom_check CHECK (capa_zoom BETWEEN 1.00 AND 3.00);

COMMIT;
