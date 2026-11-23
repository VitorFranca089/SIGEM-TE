-- Migracao da tabela professor para o cadastro completo do RF02.
--
-- PARA QUEM: bancos criados com o schema.sql ANTIGO, em que professor tinha so
-- a coluna "especialidade". Quem cria o banco do zero com o schema.sql atual
-- nao precisa rodar isto - ele ja nasce no formato novo.
--
-- COMO RODAR, a partir de backend/:
--   psql -h localhost -U postgres -d sigem_db -v ON_ERROR_STOP=1 -f src/config/migration_professor.sql
--
-- O QUE ESTE ARQUIVO GARANTE: ao terminar, a tabela professor fica igual a que
-- o schema.sql cria - mesmas colunas, na mesma ordem, com as mesmas regras de
-- obrigatoriedade. A primeira versao desta migracao acrescentava as colunas sem
-- o NOT NULL e mantinha a coluna antiga, entao um banco migrado e um banco novo
-- ficavam diferentes: o migrado aceitava professor sem CPF.
--
-- POR QUE ALTER TABLE E NAO DROP TABLE: turma.professor_id aponta para esta
-- tabela. Um DROP TABLE seria recusado pelo banco - ou, com CASCADE, apagaria
-- essa chave estrangeira sem avisar.
--
-- ATENCAO: a coluna antiga "especialidade" e APAGADA, com o que houver nela.
-- O cadastro novo usa "especialidades" (plural, texto livre) no lugar dela.
--
-- PODE RODAR MAIS DE UMA VEZ: todo comando usa IF EXISTS / IF NOT EXISTS, ou
-- nao muda nada quando ja foi aplicado.
--
-- TUDO OU NADA: os comandos rodam dentro de uma transacao. Se ja existir algum
-- professor sem telefone, CPF ou especialidades, o SET NOT NULL falha e NADA e
-- alterado - nem as colunas novas ficam. Nesse caso, preencha esses dados
-- primeiro e rode de novo.

BEGIN;

ALTER TABLE professor
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(14),
  ADD COLUMN IF NOT EXISTS especialidades TEXT;

ALTER TABLE professor DROP COLUMN IF EXISTS especialidade;

-- Separado do ADD COLUMN porque uma coluna nova nasce vazia: exigir NOT NULL no
-- mesmo comando falharia em qualquer tabela que ja tivesse linhas.
ALTER TABLE professor
  ALTER COLUMN telefone SET NOT NULL,
  ALTER COLUMN cpf SET NOT NULL,
  ALTER COLUMN especialidades SET NOT NULL;

-- O schema.sql cria esta regra como "UNIQUE" na coluna, que o PostgreSQL batiza
-- de professor_cpf_key. Aqui ela vira um indice unico com outro nome, porque
-- ADD CONSTRAINT nao aceita IF NOT EXISTS. O efeito e o mesmo - CPF repetido e
-- recusado - e o professor.controller.js reconhece os dois nomes.
CREATE UNIQUE INDEX IF NOT EXISTS professor_cpf_unico ON professor (cpf);

COMMIT;
