// Controller dos grupos extracurriculares usados pelo RF04.
// Grupo nao substitui turma: ele e opcional e pode existir sem professor ou
// aluno, porque a participacao extracurricular nao deve bloquear a agenda.

const pool = require('../config/db');

function erro(res, status, message, detalhe) {
  return res.status(status).json({ status: 'erro', message, detalhe });
}

function inteiroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

async function professorDoUsuario(usuarioId) {
  const resultado = await pool.query(`
    SELECT p.id
    FROM professor p
    JOIN usuario u ON u.id = p.usuario_id
    WHERE u.id = $1 AND u.ativo = true
  `, [usuarioId]);
  return resultado.rows[0]?.id || null;
}

async function grupoAtivo(grupoId) {
  const resultado = await pool.query(
    'SELECT id, professor_id, criado_por FROM grupo WHERE id = $1 AND ativo = true',
    [grupoId]
  );
  return resultado.rows[0] || null;
}

async function podeGerenciar(req, grupo) {
  if (!grupo) return false;
  if (req.usuario.perfil === 'admin') return true;
  const professorId = await professorDoUsuario(req.usuario.id);
  return Boolean(
    professorId &&
    (grupo.professor_id === professorId || grupo.criado_por === req.usuario.id)
  );
}

async function listar(req, res) {
  try {
    const parametros = [];
    let filtro = '';
    // Cada $n do filtro precisa de um valor no array, na mesma ordem. Faltando
    // um, o PostgreSQL recusa a consulta inteira ("bind message supplies...").
    if (req.usuario.perfil === 'aluno') {
      parametros.push(req.usuario.id);
      filtro = ' AND EXISTS (SELECT 1 FROM grupo_membro gm2 WHERE gm2.grupo_id = g.id AND gm2.aluno_id = (SELECT a.id FROM aluno a WHERE a.usuario_id = $1))';
    } else if (req.usuario.perfil === 'professor') {
      const professorId = await professorDoUsuario(req.usuario.id);
      if (!professorId) return erro(res, 403, 'Somente um professor cadastrado pode acessar grupos');
      // criado_por guarda o id do USUARIO (como no podeGerenciar); professor_id,
      // o id da tabela professor. Sao numeros diferentes para a mesma pessoa.
      parametros.push(req.usuario.id, professorId);
      filtro = ' AND (g.criado_por = $1 OR g.professor_id = $2)';
    }

    const resultado = await pool.query(`
      SELECT g.id, g.nome, g.descricao, g.professor_id,
             pu.nome AS professor_nome,
             COUNT(gm.aluno_id)::int AS alunos_count
      FROM grupo g
      LEFT JOIN professor p ON p.id = g.professor_id
      LEFT JOIN usuario pu ON pu.id = p.usuario_id
      LEFT JOIN grupo_membro gm ON gm.grupo_id = g.id
      WHERE g.ativo = true${filtro}
      GROUP BY g.id, pu.nome
      ORDER BY g.nome
    `, parametros);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao listar os grupos', e.message);
  }
}

async function criar(req, res) {
  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
  const descricao = typeof req.body.descricao === 'string' ? req.body.descricao.trim() : null;
  if (nome.length < 2 || nome.length > 150) {
    return erro(res, 400, 'O nome do grupo deve ter entre 2 e 150 caracteres');
  }
  if (descricao && descricao.length > 2000) return erro(res, 400, 'A descrição do grupo é muito longa');

  try {
    let professorId = inteiroPositivo(req.body.professor_id);
    if (req.usuario.perfil === 'professor') {
      const proprioId = await professorDoUsuario(req.usuario.id);
      if (!proprioId) return erro(res, 403, 'Somente um professor cadastrado pode criar grupos');
      if (professorId && professorId !== proprioId) return erro(res, 403, 'Um professor não pode indicar outro responsável');
      // O responsavel continua opcional, mas quando informado pelo professor
      // so pode ser ele mesmo.
      professorId = professorId || null;
    }
    if (professorId) {
      const professor = await pool.query(`
        SELECT p.id FROM professor p
        JOIN usuario u ON u.id = p.usuario_id
        WHERE p.id = $1 AND u.ativo = true
      `, [professorId]);
      if (professor.rows.length === 0) return erro(res, 400, 'O professor indicado não está ativo');
    }

    const resultado = await pool.query(`
      INSERT INTO grupo (nome, descricao, professor_id, criado_por)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nome, descricao, professor_id
    `, [nome, descricao || null, professorId, req.usuario.id]);
    res.status(201).json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    erro(res, 500, 'Falha ao criar o grupo', e.message);
  }
}

async function listarMembros(req, res) {
  try {
    const grupo = await grupoAtivo(req.params.id);
    if (!grupo) return erro(res, 404, 'Grupo não encontrado');
    if (!(await podeGerenciar(req, grupo))) return erro(res, 403, 'Você não tem acesso a este grupo');
    const resultado = await pool.query(`
      SELECT a.id, u.nome, u.email
      FROM grupo_membro gm
      JOIN aluno a ON a.id = gm.aluno_id
      JOIN usuario u ON u.id = a.usuario_id
      WHERE gm.grupo_id = $1 AND u.ativo = true
      ORDER BY u.nome
    `, [req.params.id]);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao listar os membros do grupo', e.message);
  }
}

async function adicionarMembro(req, res) {
  const alunoId = inteiroPositivo(req.body.aluno_id);
  if (!alunoId) return erro(res, 400, 'Selecione um aluno');
  try {
    const grupo = await grupoAtivo(req.params.id);
    if (!grupo) return erro(res, 404, 'Grupo não encontrado');
    if (!(await podeGerenciar(req, grupo))) return erro(res, 403, 'Você não pode alterar este grupo');
    const aluno = await pool.query(`
      SELECT a.id FROM aluno a
      JOIN usuario u ON u.id = a.usuario_id
      WHERE a.id = $1 AND u.ativo = true
    `, [alunoId]);
    if (aluno.rows.length === 0) return erro(res, 400, 'O aluno selecionado não está ativo');
    await pool.query(
      'INSERT INTO grupo_membro (grupo_id, aluno_id) VALUES ($1, $2)',
      [req.params.id, alunoId]
    );
    res.status(201).json({ status: 'ok', message: 'Aluno adicionado ao grupo' });
  } catch (e) {
    if (e.code === '23505') return erro(res, 409, 'Este aluno já participa do grupo');
    erro(res, 500, 'Falha ao adicionar o aluno ao grupo', e.message);
  }
}

async function removerMembro(req, res) {
  const alunoId = inteiroPositivo(req.params.alunoId);
  if (!alunoId) return erro(res, 400, 'Aluno inválido');
  try {
    const grupo = await grupoAtivo(req.params.id);
    if (!grupo) return erro(res, 404, 'Grupo não encontrado');
    if (!(await podeGerenciar(req, grupo))) return erro(res, 403, 'Você não pode alterar este grupo');
    const resultado = await pool.query(
      'DELETE FROM grupo_membro WHERE grupo_id = $1 AND aluno_id = $2 RETURNING aluno_id',
      [req.params.id, alunoId]
    );
    if (resultado.rows.length === 0) return erro(res, 404, 'Aluno não participa deste grupo');
    res.json({ status: 'ok', message: 'Aluno removido do grupo' });
  } catch (e) {
    erro(res, 500, 'Falha ao remover o aluno do grupo', e.message);
  }
}

module.exports = { listar, criar, listarMembros, adicionarMembro, removerMembro };
