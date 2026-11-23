// Controller do RF03 - turmas, solicitacoes e matriculas.
//
// Uma turma junta um curso, um professor, um horario e os alunos matriculados.
// Professor pode propor uma turma; somente admin aprova/edita a turma oficial.
// A exclusao e logica para que RF04 e RF05 possam guardar historico depois.

const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const { PASTA_CAPAS } = require('../middlewares/upload');

const STATUS_VALIDOS = ['solicitada', 'ativa', 'recusada', 'encerrada'];
const DIAS_VALIDOS = new Set([0, 1, 2, 3, 4, 5, 6]);

function erro(res, status, message, detalhe) {
  return res.status(status).json({ status: 'erro', message, detalhe });
}

function inteiroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function horarioValido(valor) {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

function normalizarCapaUrl(valor) {
  if (valor == null || String(valor).trim() === '') return null;
  if (typeof valor !== 'string' || valor.trim().length > 1000) return undefined;
  try {
    const url = new URL(valor.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.toString();
  } catch (e) {
    return undefined;
  }
}

function normalizarAjusteCapa(valor, minimo, maximo, padrao) {
  if (valor == null || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < minimo || numero > maximo) return undefined;
  return numero;
}

function ajustesDeCapa(dados, atuais = {}) {
  const posX = normalizarAjusteCapa(dados.capa_pos_x, 0, 100, atuais.capa_pos_x ?? 50);
  const posY = normalizarAjusteCapa(dados.capa_pos_y, 0, 100, atuais.capa_pos_y ?? 50);
  const zoom = normalizarAjusteCapa(dados.capa_zoom, 1, 3, atuais.capa_zoom ?? 1);
  if (posX === undefined || posY === undefined || zoom === undefined) return undefined;
  return { posX, posY, zoom };
}

async function apagarCapaAnterior(url) {
  if (!url || !url.startsWith('/uploads/capas/')) return;
  try {
    await fs.unlink(path.join(PASTA_CAPAS, path.basename(url)));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Falha ao remover capa anterior:', e.message);
  }
}

function minutos(horario) {
  const [hora, minuto] = horario.split(':').map(Number);
  return hora * 60 + minuto;
}

function validarDados(dados, { exigirProfessor = true } = {}) {
  const problemas = [];
  const cursoId = inteiroPositivo(dados.curso_id);
  const professorId = inteiroPositivo(dados.professor_id);
  const dia = dados.dia_semana === '' || dados.dia_semana == null
    ? null
    : Number(dados.dia_semana);

  if (!cursoId) problemas.push('Selecione um curso');
  if (exigirProfessor && !professorId) problemas.push('Selecione um professor');
  if (!dados.nome || dados.nome.trim().length === 0) {
    problemas.push('O nome da turma é obrigatório');
  } else if (dados.nome.trim().length < 2) {
    problemas.push('O nome da turma precisa ter pelo menos 2 caracteres');
  } else if (dados.nome.trim().length > 150) {
    problemas.push('O nome da turma pode ter no máximo 150 caracteres');
  }

  if (!Number.isInteger(dia) || !DIAS_VALIDOS.has(dia)) {
    problemas.push('Selecione um dia da semana');
  }
  if (!horarioValido(dados.hora_inicio) || !horarioValido(dados.hora_fim)) {
    problemas.push('Informe horários válidos para início e fim');
  } else if (minutos(dados.hora_inicio) >= minutos(dados.hora_fim)) {
    problemas.push('O horário de início deve ser anterior ao horário de fim');
  }

  if (dados.status != null && !STATUS_VALIDOS.includes(dados.status)) {
    problemas.push('Status de turma inválido');
  }

  return { problemas, cursoId, professorId, dia };
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

async function cursoAtivo(cursoId) {
  const resultado = await pool.query(
    'SELECT id FROM curso WHERE id = $1 AND ativo = true',
    [cursoId]
  );
  return resultado.rows.length > 0;
}

async function professorAtivo(professorId) {
  const resultado = await pool.query(`
    SELECT p.id
    FROM professor p
    JOIN usuario u ON u.id = p.usuario_id
    WHERE p.id = $1 AND u.ativo = true
  `, [professorId]);
  return resultado.rows.length > 0;
}

async function existeConflito(professorId, dia, inicio, fim, ignorarId = null) {
  const resultado = await pool.query(`
    SELECT 1
    FROM turma
    WHERE ativo = true
      AND status = 'ativa'
      AND professor_id = $1
      AND dia_semana = $2
      AND hora_inicio < $4::time
      AND hora_fim > $3::time
      AND ($5::int IS NULL OR id <> $5)
    LIMIT 1
  `, [professorId, dia, inicio, fim, ignorarId]);
  return resultado.rows.length > 0;
}

function filtroDeAcesso(req, valores, indice) {
  if (req.usuario.perfil === 'admin') return { sql: '', parametros: valores };
  return {
    sql: ' AND (t.professor_id = $' + indice + ' OR t.solicitante_id = $' + indice + ')',
    parametros: [...valores, req.usuario.professorId]
  };
}

const SELECT_TURMAS = `
  SELECT
    t.id,
    t.curso_id,
    c.nome AS curso_nome,
    t.professor_id,
    pu.nome AS professor_nome,
    t.solicitante_id,
    su.nome AS solicitante_nome,
    t.nome,
    t.dia_semana,
    TO_CHAR(t.hora_inicio, 'HH24:MI') AS hora_inicio,
    TO_CHAR(t.hora_fim, 'HH24:MI') AS hora_fim,
    t.capa_url,
    t.capa_pos_x,
    t.capa_pos_y,
    t.capa_zoom,
    t.status,
    t.ativo,
    COUNT(m.aluno_id)::int AS alunos_count
  FROM turma t
  JOIN curso c ON c.id = t.curso_id
  JOIN professor p ON p.id = t.professor_id
  JOIN usuario pu ON pu.id = p.usuario_id
  LEFT JOIN professor sp ON sp.id = t.solicitante_id
  LEFT JOIN usuario su ON su.id = sp.usuario_id
  LEFT JOIN matricula m ON m.turma_id = t.id
`;

async function carregarProfessorNaRequisicao(req) {
  if (req.usuario.perfil === 'admin') return true;
  const professorId = await professorDoUsuario(req.usuario.id);
  if (!professorId) return false;
  req.usuario.professorId = professorId;
  return true;
}

async function listar(req, res) {
  try {
    if (!(await carregarProfessorNaRequisicao(req))) {
      return erro(res, 403, 'Somente um professor cadastrado pode acessar turmas');
    }

    const acesso = filtroDeAcesso(req, [], 1);
    const resultado = await pool.query(`
      ${SELECT_TURMAS}
      WHERE t.ativo = true${acesso.sql}
      GROUP BY t.id, c.nome, pu.nome, su.nome
      ORDER BY CASE t.status WHEN 'solicitada' THEN 0 WHEN 'ativa' THEN 1 ELSE 2 END,
               c.nome, t.nome
    `, acesso.parametros);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao listar as turmas', e.message);
  }
}

// GET /api/turmas/minhas -> classes em que o aluno autenticado esta matriculado
async function listarDoAluno(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT
        t.id,
        t.nome,
        c.nome AS curso_nome,
        pu.nome AS professor_nome,
        pu.email AS professor_email,
        EXTRACT(ISODOW FROM CURRENT_DATE)::int AS hoje,
        t.dia_semana,
        TO_CHAR(t.hora_inicio, 'HH24:MI') AS hora_inicio,
        TO_CHAR(t.hora_fim, 'HH24:MI') AS hora_fim,
        t.capa_url,
        t.capa_pos_x,
        t.capa_pos_y,
        t.capa_zoom,
        t.status
      FROM matricula m
      JOIN aluno a ON a.id = m.aluno_id
      JOIN usuario au ON au.id = a.usuario_id
      JOIN turma t ON t.id = m.turma_id
      JOIN curso c ON c.id = t.curso_id
      JOIN professor p ON p.id = t.professor_id
      JOIN usuario pu ON pu.id = p.usuario_id
      WHERE au.id = $1
        AND au.ativo = true
        AND t.ativo = true
        AND t.status = 'ativa'
      ORDER BY t.dia_semana, t.hora_inicio, t.nome
    `, [req.usuario.id]);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao carregar suas classes', e.message);
  }
}

async function buscarPorId(req, res) {
  try {
    if (!(await carregarProfessorNaRequisicao(req))) {
      return erro(res, 403, 'Somente um professor cadastrado pode acessar turmas');
    }

    const acesso = filtroDeAcesso(req, [req.params.id], 2);
    const resultado = await pool.query(`
      ${SELECT_TURMAS}
      WHERE t.id = $1 AND t.ativo = true${acesso.sql}
      GROUP BY t.id, c.nome, pu.nome, su.nome
    `, acesso.parametros);

    if (resultado.rows.length === 0) return erro(res, 404, 'Turma não encontrada');
    res.json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    erro(res, 500, 'Falha ao buscar a turma', e.message);
  }
}

async function criar(req, res) {
  const ehAdmin = req.usuario.perfil === 'admin';
  const professorIdInformado = ehAdmin ? req.body.professor_id : null;
  const dados = {
    ...req.body,
    professor_id: professorIdInformado,
    status: ehAdmin ? 'ativa' : 'solicitada'
  };
  // O professor nao escolhe outro professor: o proprio usuario autenticado
  // vira o professor da solicitacao. Por isso a validacao do id fica para
  // depois, quando o perfil e resolvido no banco.
  const validacao = validarDados(dados, { exigirProfessor: ehAdmin });
  if (validacao.problemas.length > 0) {
    return erro(res, 400, validacao.problemas[0], validacao.problemas.join(' | '));
  }
  const capaUrl = normalizarCapaUrl(req.body.capa_url);
  if (capaUrl === undefined) return erro(res, 400, 'Informe uma URL de capa valida');
  const ajustes = ajustesDeCapa(req.body);
  if (!ajustes) return erro(res, 400, 'Informe um enquadramento de capa válido');

  try {
    let professorId = validacao.professorId;
    let solicitanteId = null;

    if (ehAdmin) {
      if (!(await professorAtivo(professorId))) {
        return erro(res, 400, 'O professor selecionado não está ativo');
      }
    } else {
      professorId = await professorDoUsuario(req.usuario.id);
      if (!professorId) return erro(res, 403, 'Somente um professor cadastrado pode solicitar turmas');
      solicitanteId = professorId;
    }

    if (!(await cursoAtivo(validacao.cursoId))) {
      return erro(res, 400, 'O curso selecionado não está ativo');
    }

    if (ehAdmin && await existeConflito(
      professorId,
      validacao.dia,
      req.body.hora_inicio,
      req.body.hora_fim
    )) {
      return erro(res, 409, 'Esse professor já possui uma turma nesse horário');
    }

    const resultado = await pool.query(`
      INSERT INTO turma (
        curso_id, professor_id, solicitante_id, nome,
        dia_semana, hora_inicio, hora_fim, capa_url,
        capa_pos_x, capa_pos_y, capa_zoom, status, ativo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING id
    `, [
      validacao.cursoId,
      professorId,
      solicitanteId,
      req.body.nome.trim(),
      validacao.dia,
      req.body.hora_inicio,
      req.body.hora_fim,
      capaUrl,
      ajustes.posX,
      ajustes.posY,
      ajustes.zoom,
      ehAdmin ? 'ativa' : 'solicitada'
    ]);

    res.status(201).json({
      status: 'ok',
      dados: {
        id: resultado.rows[0].id,
        status: ehAdmin ? 'ativa' : 'solicitada'
      }
    });
  } catch (e) {
    erro(res, 500, 'Falha ao criar a turma', e.message);
  }
}

async function atualizar(req, res) {
  try {
    if (!(await carregarProfessorNaRequisicao(req))) {
      return erro(res, 403, 'Somente um professor cadastrado pode atualizar solicitações');
    }

    const atual = await pool.query(
      'SELECT * FROM turma WHERE id = $1 AND ativo = true',
      [req.params.id]
    );
    if (atual.rows.length === 0) return erro(res, 404, 'Turma não encontrada');

    const turma = atual.rows[0];
    const ehAdmin = req.usuario.perfil === 'admin';
    if (!ehAdmin && (turma.status !== 'solicitada' || turma.professor_id !== req.usuario.professorId)) {
      return erro(res, 403, 'Somente a solicitação própria ainda pendente pode ser editada');
    }

    const dados = {
      curso_id: req.body.curso_id ?? turma.curso_id,
      professor_id: ehAdmin ? (req.body.professor_id ?? turma.professor_id) : turma.professor_id,
      nome: req.body.nome ?? turma.nome,
      dia_semana: req.body.dia_semana ?? turma.dia_semana,
      hora_inicio: req.body.hora_inicio ?? String(turma.hora_inicio).slice(0, 5),
      hora_fim: req.body.hora_fim ?? String(turma.hora_fim).slice(0, 5),
      status: ehAdmin ? (req.body.status ?? turma.status) : 'solicitada'
    };
    const capaUrl = req.body.capa_url === undefined
      ? turma.capa_url
      : normalizarCapaUrl(req.body.capa_url);
    if (capaUrl === undefined) return erro(res, 400, 'Informe uma URL de capa valida');
    const ajustes = ajustesDeCapa(req.body, turma);
    if (!ajustes) return erro(res, 400, 'Informe um enquadramento de capa válido');
    const validacao = validarDados(dados);
    if (validacao.problemas.length > 0) {
      return erro(res, 400, validacao.problemas[0], validacao.problemas.join(' | '));
    }

    if (!(await cursoAtivo(validacao.cursoId))) {
      return erro(res, 400, 'O curso selecionado não está ativo');
    }
    if (!(await professorAtivo(validacao.professorId))) {
      return erro(res, 400, 'O professor selecionado não está ativo');
    }

    if (dados.status === 'ativa' && await existeConflito(
      validacao.professorId,
      validacao.dia,
      dados.hora_inicio,
      dados.hora_fim,
      turma.id
    )) {
      return erro(res, 409, 'Esse professor já possui outra turma nesse horário');
    }

    const ativo = dados.status === 'recusada' || dados.status === 'encerrada' ? false : true;
    const resultado = await pool.query(`
      UPDATE turma
      SET curso_id = $1,
          professor_id = $2,
          nome = $3,
          dia_semana = $4,
          hora_inicio = $5,
          hora_fim = $6,
          capa_url = $7,
          capa_pos_x = $8,
          capa_pos_y = $9,
          capa_zoom = $10,
          status = $11,
          ativo = $12
      WHERE id = $13
      RETURNING id, status, ativo, capa_url, capa_pos_x, capa_pos_y, capa_zoom
    `, [
      validacao.cursoId,
      validacao.professorId,
      dados.nome.trim(),
      validacao.dia,
      dados.hora_inicio,
      dados.hora_fim,
      capaUrl,
      ajustes.posX,
      ajustes.posY,
      ajustes.zoom,
      dados.status,
      ativo,
      turma.id
    ]);

    res.json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    erro(res, 500, 'Falha ao atualizar a turma', e.message);
  }
}

async function atualizarCapa(req, res) {
  try {
    if (!(await carregarProfessorNaRequisicao(req))) {
      return erro(res, 403, 'Somente um professor cadastrado pode editar capas');
    }

    const atual = await pool.query(
      'SELECT id, professor_id, ativo, capa_url, capa_pos_x, capa_pos_y, capa_zoom FROM turma WHERE id = $1',
      [req.params.id]
    );
    if (atual.rows.length === 0 || !atual.rows[0].ativo) {
      return erro(res, 404, 'Turma não encontrada');
    }

    const turma = atual.rows[0];
    if (req.usuario.perfil !== 'admin' && turma.professor_id !== req.usuario.professorId) {
      return erro(res, 403, 'Você só pode editar a capa das suas turmas');
    }

    const capaUrl = normalizarCapaUrl(req.body.capa_url);
    if (capaUrl === undefined) return erro(res, 400, 'Informe uma URL de capa valida');
    const ajustes = ajustesDeCapa(req.body, turma);
    if (!ajustes) return erro(res, 400, 'Informe um enquadramento de capa válido');

    const resultado = await pool.query(
      `UPDATE turma
       SET capa_url = $1, capa_pos_x = $2, capa_pos_y = $3, capa_zoom = $4
       WHERE id = $5
       RETURNING id, capa_url, capa_pos_x, capa_pos_y, capa_zoom`,
      [capaUrl, ajustes.posX, ajustes.posY, ajustes.zoom, turma.id]
    );
    if (turma.capa_url !== capaUrl) await apagarCapaAnterior(turma.capa_url);
    res.json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    erro(res, 500, 'Falha ao atualizar a capa da turma', e.message);
  }
}

async function enviarCapa(req, res) {
  try {
    if (!(await carregarProfessorNaRequisicao(req))) {
      await fs.unlink(req.file.path).catch(() => {});
      return erro(res, 403, 'Somente um professor cadastrado pode editar capas');
    }

    const atual = await pool.query(
      'SELECT id, professor_id, ativo, capa_url, capa_pos_x, capa_pos_y, capa_zoom FROM turma WHERE id = $1',
      [req.params.id]
    );
    if (atual.rows.length === 0 || !atual.rows[0].ativo) {
      await fs.unlink(req.file.path).catch(() => {});
      return erro(res, 404, 'Turma não encontrada');
    }

    const turma = atual.rows[0];
    if (req.usuario.perfil !== 'admin' && turma.professor_id !== req.usuario.professorId) {
      await fs.unlink(req.file.path).catch(() => {});
      return erro(res, 403, 'Você só pode editar a capa das suas turmas');
    }

    const capaUrl = '/uploads/capas/' + req.file.filename;
    const ajustes = ajustesDeCapa(req.body, turma);
    if (!ajustes) {
      await fs.unlink(req.file.path).catch(() => {});
      return erro(res, 400, 'Informe um enquadramento de capa válido');
    }
    const resultado = await pool.query(
      `UPDATE turma
       SET capa_url = $1, capa_pos_x = $2, capa_pos_y = $3, capa_zoom = $4
       WHERE id = $5
       RETURNING id, capa_url, capa_pos_x, capa_pos_y, capa_zoom`,
      [capaUrl, ajustes.posX, ajustes.posY, ajustes.zoom, turma.id]
    );
    await apagarCapaAnterior(turma.capa_url);
    res.json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    erro(res, 500, 'Falha ao salvar a capa enviada', e.message);
  }
}

async function excluir(req, res) {
  try {
    const resultado = await pool.query(`
      UPDATE turma
      SET ativo = false, status = 'encerrada'
      WHERE id = $1 AND ativo = true
      RETURNING id
    `, [req.params.id]);

    if (resultado.rows.length === 0) return erro(res, 404, 'Turma não encontrada');
    res.json({ status: 'ok', message: 'Turma encerrada' });
  } catch (e) {
    erro(res, 500, 'Falha ao excluir a turma', e.message);
  }
}

async function carregarTurmaComAcesso(req, turmaId) {
  const resultado = await pool.query(
    'SELECT id, professor_id, solicitante_id, status, ativo FROM turma WHERE id = $1',
    [turmaId]
  );
  if (resultado.rows.length === 0) return { turma: null, permitido: false };

  const turma = resultado.rows[0];
  if (req.usuario.perfil === 'admin') return { turma, permitido: true };
  const professorId = req.usuario.professorId || await professorDoUsuario(req.usuario.id);
  return {
    turma,
    permitido: Boolean(professorId && (
      turma.professor_id === professorId || turma.solicitante_id === professorId
    ))
  };
}

async function listarAlunos(req, res) {
  try {
    if (!(await carregarProfessorNaRequisicao(req))) {
      return erro(res, 403, 'Somente um professor cadastrado pode acessar alunos da turma');
    }
    const acesso = await carregarTurmaComAcesso(req, req.params.id);
    if (!acesso.turma || !acesso.turma.ativo) return erro(res, 404, 'Turma não encontrada');
    if (!acesso.permitido) return erro(res, 403, 'Você não tem acesso a esta turma');

    const resultado = await pool.query(`
      SELECT a.id, u.nome, u.email, TO_CHAR(a.data_nascimento, 'YYYY-MM-DD') AS data_nascimento
      FROM matricula m
      JOIN aluno a ON a.id = m.aluno_id
      JOIN usuario u ON u.id = a.usuario_id
      WHERE m.turma_id = $1 AND u.ativo = true
      ORDER BY u.nome
    `, [req.params.id]);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao listar os alunos da turma', e.message);
  }
}

async function verificarAcessoAtiva(req, turmaId) {
  const acesso = await carregarTurmaComAcesso(req, turmaId);
  if (!acesso.turma || !acesso.turma.ativo || acesso.turma.status !== 'ativa') {
    return { ...acesso, ativa: false };
  }
  return { ...acesso, ativa: true };
}

async function adicionarAluno(req, res) {
  const alunoId = inteiroPositivo(req.body.aluno_id);
  if (!alunoId) return erro(res, 400, 'Selecione um aluno');

  try {
    if (!(await carregarProfessorNaRequisicao(req))) {
      return erro(res, 403, 'Somente um professor cadastrado pode matricular alunos');
    }
    const acesso = await verificarAcessoAtiva(req, req.params.id);
    if (!acesso.turma || !acesso.turma.ativo) return erro(res, 404, 'Turma não encontrada');
    if (!acesso.permitido) return erro(res, 403, 'Você não tem acesso a esta turma');
    if (!acesso.ativa) return erro(res, 409, 'Somente uma turma ativa pode receber alunos');

    const aluno = await pool.query(`
      SELECT a.id
      FROM aluno a
      JOIN usuario u ON u.id = a.usuario_id
      WHERE a.id = $1 AND u.ativo = true
    `, [alunoId]);
    if (aluno.rows.length === 0) return erro(res, 400, 'O aluno selecionado não está ativo');

    await pool.query(
      'INSERT INTO matricula (turma_id, aluno_id) VALUES ($1, $2)',
      [req.params.id, alunoId]
    );
    res.status(201).json({ status: 'ok', message: 'Aluno adicionado a turma' });
  } catch (e) {
    if (e.code === '23505') return erro(res, 409, 'Este aluno já está matriculado na turma');
    erro(res, 500, 'Falha ao adicionar o aluno a turma', e.message);
  }
}

async function removerAluno(req, res) {
  const alunoId = inteiroPositivo(req.params.alunoId);
  if (!alunoId) return erro(res, 400, 'Aluno inválido');

  try {
    if (!(await carregarProfessorNaRequisicao(req))) {
      return erro(res, 403, 'Somente um professor cadastrado pode remover alunos');
    }
    const acesso = await verificarAcessoAtiva(req, req.params.id);
    if (!acesso.turma || !acesso.turma.ativo) return erro(res, 404, 'Turma não encontrada');
    if (!acesso.permitido) return erro(res, 403, 'Você não tem acesso a esta turma');
    if (!acesso.ativa) return erro(res, 409, 'Somente uma turma ativa pode ter matrículas alteradas');

    const resultado = await pool.query(
      'DELETE FROM matricula WHERE turma_id = $1 AND aluno_id = $2 RETURNING aluno_id',
      [req.params.id, alunoId]
    );
    if (resultado.rows.length === 0) return erro(res, 404, 'Aluno não está matriculado nesta turma');
    res.json({ status: 'ok', message: 'Aluno removido da turma' });
  } catch (e) {
    erro(res, 500, 'Falha ao remover o aluno da turma', e.message);
  }
}

module.exports = {
  listar,
  listarDoAluno,
  buscarPorId,
  criar,
  atualizar,
  atualizarCapa,
  enviarCapa,
  excluir,
  listarAlunos,
  adicionarAluno,
  removerAluno
};
