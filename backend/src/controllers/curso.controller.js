// Controller do RF03 - cadastro de cursos.
//
// Curso e um catalogo administrado pelo admin. Professores podem consulta-lo
// para pedir uma turma, mas nao alteram o catalogo diretamente.

const pool = require('../config/db');

function erro(res, status, message, detalhe) {
  return res.status(status).json({ status: 'erro', message, detalhe });
}

function validarDados({ nome, descricao }) {
  const problemas = [];
  if (!nome || nome.trim().length === 0) {
    problemas.push('O nome do curso é obrigatório');
  } else if (nome.trim().length < 2) {
    problemas.push('O nome do curso precisa ter pelo menos 2 caracteres');
  } else if (nome.trim().length > 150) {
    problemas.push('O nome do curso pode ter no máximo 150 caracteres');
  }

  if (descricao != null && descricao.length > 2000) {
    problemas.push('A descrição do curso pode ter no máximo 2000 caracteres');
  }
  return problemas;
}

async function listar(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT id, nome, descricao
      FROM curso
      WHERE ativo = true
      ORDER BY nome
    `);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao listar os cursos', e.message);
  }
}

async function buscarPorId(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT id, nome, descricao
      FROM curso
      WHERE id = $1 AND ativo = true
    `, [req.params.id]);

    if (resultado.rows.length === 0) return erro(res, 404, 'Curso não encontrado');
    res.json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    erro(res, 500, 'Falha ao buscar o curso', e.message);
  }
}

async function criar(req, res) {
  const { nome, descricao } = req.body;
  const problemas = validarDados({ nome, descricao });
  if (problemas.length > 0) return erro(res, 400, problemas[0], problemas.join(' | '));

  try {
    const resultado = await pool.query(`
      INSERT INTO curso (nome, descricao)
      VALUES ($1, $2)
      RETURNING id, nome, descricao
    `, [nome.trim(), descricao?.trim() || null]);
    res.status(201).json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    erro(res, 500, 'Falha ao cadastrar o curso', e.message);
  }
}

async function atualizar(req, res) {
  const { nome, descricao } = req.body;
  const problemas = validarDados({ nome, descricao });
  if (problemas.length > 0) return erro(res, 400, problemas[0], problemas.join(' | '));

  try {
    const resultado = await pool.query(`
      UPDATE curso
      SET nome = $1, descricao = $2
      WHERE id = $3 AND ativo = true
      RETURNING id, nome, descricao
    `, [nome.trim(), descricao?.trim() || null, req.params.id]);

    if (resultado.rows.length === 0) return erro(res, 404, 'Curso não encontrado');
    res.json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    erro(res, 500, 'Falha ao atualizar o curso', e.message);
  }
}

async function excluir(req, res) {
  try {
    const dependencias = await pool.query(
      'SELECT 1 FROM turma WHERE curso_id = $1 LIMIT 1',
      [req.params.id]
    );

    if (dependencias.rows.length > 0) {
      return erro(
        res,
        409,
        'Este curso possui turmas e não pode ser excluído. Desative-o apenas quando não houver histórico.'
      );
    }

    const resultado = await pool.query(`
      UPDATE curso
      SET ativo = false
      WHERE id = $1 AND ativo = true
      RETURNING id
    `, [req.params.id]);

    if (resultado.rows.length === 0) return erro(res, 404, 'Curso não encontrado');
    res.json({ status: 'ok', message: 'Curso excluído' });
  } catch (e) {
    erro(res, 500, 'Falha ao excluir o curso', e.message);
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir };
