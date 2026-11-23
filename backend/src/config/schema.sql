-- Script de criacao das tabelas do SIGEM
-- Baseado no diagrama de classes/ER do TCC e nos requisitos da Secao 4 (RF01 a RF09)
--
-- Como rodar:
--   psql -h localhost -U postgres -d sigem_db -f src/config/schema.sql
--
-- Este arquivo so cria tabelas, nunca apaga. Se precisar recriar o banco do
-- zero, os DROP devem ser feitos a mao e com cuidado: eles apagam os dados.

CREATE TABLE usuario (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('admin', 'professor', 'aluno')),
  -- RF01 e RF02 pedem exclusao de alunos e professores, mas apagar de verdade
  -- esbarra nas chaves estrangeiras de matricula e frequencia. Em vez de apagar,
  -- marcamos como inativo: some das listagens e o historico continua intacto.
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Codigos de recuperacao de senha: armazenamos somente o hash do codigo.
-- O codigo em texto claro existe apenas no e-mail e nunca fica no banco.
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

-- professor e aluno sao "satelites" de usuario: guardam so o que e especifico de
-- cada perfil. O login, o nome e o estado ativo/inativo ficam todos em usuario.
CREATE TABLE professor (
  id SERIAL PRIMARY KEY,
  -- UNIQUE porque um mesmo usuario nao pode virar dois professores
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuario(id),
  telefone VARCHAR(30) NOT NULL,
  data_nascimento DATE,
  -- O controller grava so os 11 digitos, sem ponto nem traco. E isso que faz o
  -- UNIQUE funcionar: "123.456.789-09" e "12345678909" viram o mesmo valor. Os
  -- 14 caracteres sobram de proposito para o formato com pontuacao.
  -- Bancos criados antes do RF02: rodar migration_professor.sql.
  cpf VARCHAR(14) NOT NULL UNIQUE,
  especialidades TEXT NOT NULL
);

CREATE TABLE aluno (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuario(id),
  data_nascimento DATE
);

CREATE TABLE curso (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  -- Curso nao e apagado fisicamente porque turmas antigas apontam para ele.
  -- O administrador pode desativar o curso sem perder o historico.
  ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE turma (
  id SERIAL PRIMARY KEY,
  curso_id INTEGER NOT NULL REFERENCES curso(id),
  professor_id INTEGER NOT NULL REFERENCES professor(id),
  -- Quem pediu a turma. Fica nulo quando ela foi criada diretamente pelo admin.
  solicitante_id INTEGER REFERENCES professor(id),
  nome VARCHAR(150) NOT NULL,
  -- Horario semanal da turma. Em colunas separadas, e nao em texto livre, porque
  -- o RF04 (agendamento) precisa ordenar por horario e detectar choque de agenda
  -- do mesmo professor. Com VARCHAR isso seria impossivel.
  -- dia_semana: 0 = domingo ... 6 = sabado
  dia_semana SMALLINT CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME,
  hora_fim TIME,
  -- URL da capa da turma. A interface usa imagens gratuitas do Pexels.
  capa_url TEXT,
  capa_pos_x SMALLINT NOT NULL DEFAULT 50 CHECK (capa_pos_x BETWEEN 0 AND 100),
  capa_pos_y SMALLINT NOT NULL DEFAULT 50 CHECK (capa_pos_y BETWEEN 0 AND 100),
  capa_zoom NUMERIC(4, 2) NOT NULL DEFAULT 1.00 CHECK (capa_zoom BETWEEN 1.00 AND 3.00),
  status VARCHAR(20) NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('solicitada', 'ativa', 'recusada', 'encerrada')),
  -- Exclusao de turma e logica para nao quebrar futuras aulas e frequencias.
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- Relacionamento muitos-para-muitos entre turma e aluno
CREATE TABLE matricula (
  turma_id INTEGER NOT NULL REFERENCES turma(id),
  aluno_id INTEGER NOT NULL REFERENCES aluno(id),
  PRIMARY KEY (turma_id, aluno_id)
);

-- Grupo extracurricular. Professor e alunos sao opcionais: o grupo pode ser
-- criado antes de haver um responsavel ou participantes confirmados.
CREATE TABLE grupo (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  professor_id INTEGER REFERENCES professor(id),
  criado_por INTEGER NOT NULL REFERENCES usuario(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE grupo_membro (
  grupo_id INTEGER NOT NULL REFERENCES grupo(id),
  aluno_id INTEGER NOT NULL REFERENCES aluno(id),
  PRIMARY KEY (grupo_id, aluno_id)
);

-- Uma ocorrencia concreta de aula, numa data especifica. Exatamente uma das
-- duas origens deve ser preenchida: turma regular ou grupo extracurricular.
CREATE TABLE aula (
  id SERIAL PRIMARY KEY,
  turma_id INTEGER REFERENCES turma(id),
  grupo_id INTEGER REFERENCES grupo(id),
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  responsavel_id INTEGER REFERENCES professor(id),
  criado_por INTEGER NOT NULL REFERENCES usuario(id),
  status VARCHAR(20) NOT NULL DEFAULT 'agendada'
    CHECK (status IN ('agendada', 'cancelada', 'realizada')),
  observacoes TEXT,
  cancelada_em TIMESTAMPTZ,
  cancelada_por INTEGER REFERENCES usuario(id),
  motivo_cancelamento VARCHAR(500),
  CHECK (hora_inicio < hora_fim),
  CHECK ((turma_id IS NOT NULL AND grupo_id IS NULL)
      OR (turma_id IS NULL AND grupo_id IS NOT NULL))
);

CREATE INDEX aula_data_idx ON aula (data, hora_inicio, status);
CREATE INDEX aula_turma_idx ON aula (turma_id, data);
CREATE INDEX aula_grupo_idx ON aula (grupo_id, data);
CREATE INDEX grupo_membro_aluno_idx ON grupo_membro (aluno_id, grupo_id);

CREATE TABLE frequencia (
  id SERIAL PRIMARY KEY,
  aula_id INTEGER NOT NULL REFERENCES aula(id),
  aluno_id INTEGER NOT NULL REFERENCES aluno(id),
  presente BOOLEAN NOT NULL DEFAULT false,
  -- o mesmo aluno so pode ter um registro de presenca por aula
  UNIQUE (aula_id, aluno_id)
);

CREATE TABLE arquivo (
  id SERIAL PRIMARY KEY,
  -- quem enviou
  usuario_id INTEGER NOT NULL REFERENCES usuario(id),
  -- RF07: o professor vincula o arquivo a uma turma OU a um aluno especifico.
  -- RF08: o aluno envia audio da propria pratica, entao aponta so para si.
  -- Os dois sao opcionais justamente porque cada caso preenche um deles.
  turma_id INTEGER REFERENCES turma(id),
  aluno_id INTEGER REFERENCES aluno(id),
  tipo VARCHAR(50),
  -- caminho no disco. O arquivo em si nao vai para o banco: audio em coluna
  -- deixa o backup lento e o dump gigante.
  caminho VARCHAR(255) NOT NULL,
  -- nome que o arquivo tinha na maquina de quem enviou, para o download sair legivel
  nome_original VARCHAR(255),
  enviado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RF09: o primeiro download de cada material por cada usuario. E o registro
-- que o orientador pediu ("o aluno fez o download"): o professor e avisado uma
-- vez por aluno, e nao a cada clique. A chave primaria composta e o que garante
-- o "uma vez": a segunda tentativa de gravar a mesma dupla e ignorada.
-- ON DELETE CASCADE porque o arquivo e apagado de verdade (RN21): sem isso, o
-- registro de download impediria a exclusao do material.
CREATE TABLE arquivo_download (
  arquivo_id INTEGER NOT NULL REFERENCES arquivo(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id),
  baixado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (arquivo_id, usuario_id)
);

-- RF09: avisos dentro do sistema. A mensagem ja vai pronta, como texto: e um
-- registro do que aconteceu naquele momento, e nao precisa mudar se um nome
-- mudar depois. arquivo_id leva a notificacao junto quando o arquivo e apagado:
-- avisar de um material que nao existe mais so confundiria o aluno.
CREATE TABLE notificacao (
  id SERIAL PRIMARY KEY,
  -- quem recebe
  usuario_id INTEGER NOT NULL REFERENCES usuario(id),
  mensagem VARCHAR(500) NOT NULL,
  arquivo_id INTEGER REFERENCES arquivo(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  criada_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX notificacao_usuario_idx ON notificacao (usuario_id, lida, criada_em);
