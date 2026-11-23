// Controller do RF04 - agenda de aulas regulares e encontros de grupos.
// Uma aula e uma ocorrencia concreta: pertence a uma turma OU a um grupo.
// Grupo e extracurricular, portanto pode nao ter professor nem aluno.

const pool = require('../config/db');
const { enviarAvisoCancelamentoAula } = require('../utils/mailer');

const HORAS_CANCELAMENTO = 6;
const STATUS_VALIDOS = new Set(['agendada', 'cancelada', 'realizada']);

function erro(res, status, message, detalhe) {
  return res.status(status).json({ status: 'erro', message, detalhe });
}

function inteiroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function horaValida(valor) {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

function minutos(hora) {
  const [horas, minutosHora] = hora.split(':').map(Number);
  return horas * 60 + minutosHora;
}

function horaBanco(hora) {
  return typeof hora === 'string' ? hora.slice(0, 5) : hora;
}

function dataHojeLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function dataHoraJaPassou(data, hora) {
  if (data < dataHojeLocal()) return true;
  if (data > dataHojeLocal()) return false;
  const agora = new Date();
  return minutos(hora) <= agora.getHours() * 60 + agora.getMinutes();
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

async function carregarProfessor(req) {
  if (req.usuario.perfil === 'admin') return null;
  const professorId = await professorDoUsuario(req.usuario.id);
  if (!professorId) throw Object.assign(new Error('Professor não cadastrado'), { status: 403 });
  return professorId;
}

const SELECT_AULA = `
  SELECT
    a.id, a.turma_id, t.nome AS turma_nome, c.nome AS curso_nome,
    a.grupo_id, g.nome AS grupo_nome, g.criado_por AS grupo_criado_por,
    a.data::text AS data, TO_CHAR(a.hora_inicio, 'HH24:MI') AS hora_inicio,
    TO_CHAR(a.hora_fim, 'HH24:MI') AS hora_fim,
    a.responsavel_id, ru.nome AS responsavel_nome,
    a.status, a.observacoes, a.cancelada_em, a.motivo_cancelamento,
    a.criado_por
  FROM aula a
  LEFT JOIN turma t ON t.id = a.turma_id
  LEFT JOIN curso c ON c.id = t.curso_id
  LEFT JOIN grupo g ON g.id = a.grupo_id
  LEFT JOIN professor rp ON rp.id = a.responsavel_id
  LEFT JOIN usuario ru ON ru.id = rp.usuario_id
`;

async function buscarAula(id) {
  const resultado = await pool.query(`${SELECT_AULA} WHERE a.id = $1`, [id]);
  return resultado.rows[0] || null;
}

async function acessoProfessorAula(req, aula, professorId) {
  if (req.usuario.perfil === 'admin') return true;
  return Boolean(
    professorId && (
      aula.responsavel_id === professorId ||
      (aula.turma_id && aula.turma_professor_id === professorId) ||
      (aula.grupo_id && aula.grupo_professor_id === professorId) ||
      (aula.grupo_id && aula.grupo_criado_por === req.usuario.id)
    )
  );
}

async function carregarAulaComPermissoes(id) {
  const resultado = await pool.query(`
    SELECT a.*, a.data::text AS data_iso,
           t.professor_id AS turma_professor_id,
           g.professor_id AS grupo_professor_id,
           g.criado_por AS grupo_criado_por
    FROM aula a
    LEFT JOIN turma t ON t.id = a.turma_id
    LEFT JOIN grupo g ON g.id = a.grupo_id
    WHERE a.id = $1
  `, [id]);
  return resultado.rows[0] || null;
}

async function idsDosParticipantes(destino) {
  const consulta = destino.tipo === 'turma'
    ? 'SELECT aluno_id FROM matricula WHERE turma_id = $1'
    : 'SELECT aluno_id FROM grupo_membro WHERE grupo_id = $1';
  const resultado = await pool.query(consulta, [destino.id]);
  return resultado.rows.map((linha) => linha.aluno_id);
}

async function carregarDestino(req, turmaId, grupoId) {
  if (turmaId) {
    const resultado = await pool.query(`
      SELECT id, nome, professor_id, status, ativo,
             TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio,
             TO_CHAR(hora_fim, 'HH24:MI') AS hora_fim
      FROM turma
      WHERE id = $1
    `, [turmaId]);
    const turma = resultado.rows[0];
    if (!turma || !turma.ativo || turma.status !== 'ativa') {
      throw Object.assign(new Error('A turma precisa estar ativa'), { status: 400 });
    }
    if (req.usuario.perfil !== 'admin') {
      const professorId = await carregarProfessor(req);
      if (turma.professor_id !== professorId) {
        throw Object.assign(new Error('Você só pode agendar aulas da sua turma'), { status: 403 });
      }
    }
    return { tipo: 'turma', id: turma.id, nome: turma.nome, professorId: turma.professor_id, turma };
  }

  const resultado = await pool.query(`
    SELECT id, nome, professor_id, criado_por, ativo
    FROM grupo
    WHERE id = $1
  `, [grupoId]);
  const grupo = resultado.rows[0];
  if (!grupo || !grupo.ativo) {
    throw Object.assign(new Error('O grupo não está ativo'), { status: 400 });
  }
  if (req.usuario.perfil !== 'admin') {
    const professorId = await carregarProfessor(req);
    if (grupo.professor_id && grupo.professor_id !== professorId && grupo.criado_por !== req.usuario.id) {
      throw Object.assign(new Error('Você não pode agendar encontros deste grupo'), { status: 403 });
    }
  }
  return { tipo: 'grupo', id: grupo.id, nome: grupo.nome, professorId: grupo.professor_id, grupo };
}

async function responsavelDaAula(req, destino, informado) {
  let professorId = inteiroPositivo(informado) || destino.professorId || null;
  if (destino.tipo === 'turma') return destino.professorId;

  if (req.usuario.perfil !== 'admin') {
    professorId = await carregarProfessor(req);
  }
  if (professorId) {
    const resultado = await pool.query(`
      SELECT p.id FROM professor p
      JOIN usuario u ON u.id = p.usuario_id
      WHERE p.id = $1 AND u.ativo = true
    `, [professorId]);
    if (resultado.rows.length === 0) {
      throw Object.assign(new Error('O professor responsável não está ativo'), { status: 400 });
    }
  }
  return professorId;
}

async function verificarConflitos({ data, inicio, fim, responsavelId, turmaId, participantes, ignorarId = null }) {
  const parametrosProfessor = [data, inicio, fim, responsavelId, ignorarId];
  if (responsavelId) {
    const conflitoAula = await pool.query(`
      SELECT 1
      FROM aula a
      WHERE a.status = 'agendada'
        AND a.data = $1::date
        AND a.hora_inicio < $3::time
        AND a.hora_fim > $2::time
        AND a.responsavel_id = $4
        AND ($5::int IS NULL OR a.id <> $5)
      LIMIT 1
    `, parametrosProfessor);
    if (conflitoAula.rows.length > 0) return 'O professor responsável já possui outra aula nesse horário';

    const conflitoTurma = await pool.query(`
      SELECT 1
      FROM turma t
      WHERE t.ativo = true AND t.status = 'ativa'
        AND t.professor_id = $4
        AND t.dia_semana = EXTRACT(DOW FROM $1::date)::int
        AND t.hora_inicio < $3::time
        AND t.hora_fim > $2::time
        AND ($5::int IS NULL OR t.id <> $5)
      LIMIT 1
    `, [data, inicio, fim, responsavelId, turmaId]);
    // Cada valor da lista precisa aparecer na consulta: um valor que sobra
    // (como o ignorarId, que so serve para aula) faz o PostgreSQL recusar a
    // consulta inteira, porque ele nao consegue descobrir de que tipo ele e.
    if (conflitoTurma.rows.length > 0) return 'O professor responsável já possui uma turma nesse horário';
  }

  if (participantes.length === 0) return null;

  const conflitoAulaAluno = await pool.query(`
    SELECT 1
    FROM aula a
    WHERE a.status = 'agendada'
      AND a.data = $1::date
      AND a.hora_inicio < $3::time
      AND a.hora_fim > $2::time
      AND ($4::int IS NULL OR a.id <> $4)
      AND (
        EXISTS (
          SELECT 1 FROM matricula m
          WHERE m.turma_id = a.turma_id AND m.aluno_id = ANY($5::int[])
        )
        OR EXISTS (
          SELECT 1 FROM grupo_membro gm
          WHERE gm.grupo_id = a.grupo_id AND gm.aluno_id = ANY($5::int[])
        )
      )
    LIMIT 1
  `, [data, inicio, fim, ignorarId, participantes]);
  if (conflitoAulaAluno.rows.length > 0) return 'Um dos alunos já possui outra aula nesse horário';

  const conflitoTurmaAluno = await pool.query(`
    SELECT 1
    FROM matricula m
    JOIN turma t ON t.id = m.turma_id
    WHERE m.aluno_id = ANY($1::int[])
      AND t.ativo = true AND t.status = 'ativa'
      AND t.dia_semana = EXTRACT(DOW FROM $2::date)::int
      AND t.hora_inicio < $4::time
      AND t.hora_fim > $3::time
      AND ($5::int IS NULL OR t.id <> $5)
    LIMIT 1
  `, [participantes, data, inicio, fim, turmaId]);
  if (conflitoTurmaAluno.rows.length > 0) return 'Um dos alunos está matriculado em uma turma nesse horário';

  return null;
}

function validarDados(data, inicio, fim, observacoes) {
  if (!dataValida(data)) return 'Informe uma data valida';
  if (!horaValida(inicio) || !horaValida(fim)) return 'Informe horários válidos';
  if (minutos(inicio) >= minutos(fim)) return 'O horário de início deve ser anterior ao horário de fim';
  if (dataHoraJaPassou(data, inicio)) return 'A aula precisa estar no futuro';
  if (observacoes && observacoes.length > 2000) return 'As observações são muito longas';
  return null;
}

async function listar(req, res) {
  try {
    const inicio = req.query.inicio || dataHojeLocal();
    const fim = req.query.fim || null;
    if (!dataValida(inicio) || (fim && !dataValida(fim))) return erro(res, 400, 'Intervalo de datas inválido');

    const parametros = [inicio];
    const filtros = ['a.data >= $1::date'];
    if (fim) {
      parametros.push(fim);
      filtros.push(`a.data <= $${parametros.length}::date`);
    }
    if (req.query.status) {
      if (!STATUS_VALIDOS.has(req.query.status)) return erro(res, 400, 'Status de aula inválido');
      parametros.push(req.query.status);
      filtros.push(`a.status = $${parametros.length}`);
    }

    if (req.usuario.perfil === 'admin') {
      // Administrador consulta a agenda inteira.
    } else if (req.usuario.perfil === 'professor') {
      const professorId = await carregarProfessor(req);
      parametros.push(professorId, req.usuario.id);
      const indiceProfessor = parametros.length - 1;
      const indiceUsuario = parametros.length;
      filtros.push(`(
        a.responsavel_id = $${indiceProfessor}
        OR t.professor_id = $${indiceProfessor}
        OR g.professor_id = $${indiceProfessor}
        OR g.criado_por = $${indiceUsuario}
      )`);
    } else {
      const aluno = await pool.query('SELECT id FROM aluno WHERE usuario_id = $1', [req.usuario.id]);
      if (aluno.rows.length === 0) return erro(res, 403, 'Aluno não cadastrado');
      parametros.push(aluno.rows[0].id);
      const indiceAluno = parametros.length;
      filtros.push(`(
        EXISTS (SELECT 1 FROM matricula m WHERE m.turma_id = a.turma_id AND m.aluno_id = $${indiceAluno})
        OR EXISTS (SELECT 1 FROM grupo_membro gm WHERE gm.grupo_id = a.grupo_id AND gm.aluno_id = $${indiceAluno})
      )`);
    }

    const resultado = await pool.query(`
      ${SELECT_AULA}
      WHERE ${filtros.join(' AND ')}
      ORDER BY a.data, a.hora_inicio, COALESCE(t.nome, g.nome)
    `, parametros);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, e.status || 500, e.status ? e.message : 'Falha ao listar a agenda', e.status ? undefined : e.message);
  }
}

async function criar(req, res) {
  const turmaId = inteiroPositivo(req.body.turma_id);
  const grupoId = inteiroPositivo(req.body.grupo_id);
  if (Boolean(turmaId) === Boolean(grupoId)) return erro(res, 400, 'Escolha uma turma ou um grupo, nunca os dois');

  const data = req.body.data;
  try {
    const destino = await carregarDestino(req, turmaId, grupoId);
    const inicio = req.body.hora_inicio || (destino.turma && destino.turma.hora_inicio);
    const fim = req.body.hora_fim || (destino.turma && destino.turma.hora_fim);
    const observacoes = typeof req.body.observacoes === 'string' ? req.body.observacoes.trim() : null;
    const problema = validarDados(data, inicio, fim, observacoes);
    if (problema) return erro(res, 400, problema);
    const responsavelId = await responsavelDaAula(req, destino, req.body.responsavel_id);
    const participantes = await idsDosParticipantes(destino);
    const conflito = await verificarConflitos({
      data, inicio, fim, responsavelId,
      turmaId, participantes
    });
    if (conflito) return erro(res, 409, conflito);

    const resultado = await pool.query(`
      INSERT INTO aula (
        turma_id, grupo_id, data, hora_inicio, hora_fim,
        responsavel_id, criado_por, observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      turmaId, grupoId, data, inicio, fim, responsavelId,
      req.usuario.id, observacoes || null
    ]);
    const aula = await buscarAula(resultado.rows[0].id);
    res.status(201).json({ status: 'ok', dados: aula });
  } catch (e) {
    erro(res, e.status || 500, e.status ? e.message : 'Falha ao agendar a aula', e.status ? undefined : e.message);
  }
}

async function atualizar(req, res) {
  try {
    const aula = await carregarAulaComPermissoes(req.params.id);
    if (!aula) return erro(res, 404, 'Aula não encontrada');
    const professorId = req.usuario.perfil === 'admin' ? null : await carregarProfessor(req);
    const acesso = await acessoProfessorAula(req, aula, professorId);
    if (!acesso) return erro(res, 403, 'Você não pode alterar esta aula');
    if (aula.status !== 'agendada') return erro(res, 409, 'Somente aulas agendadas podem ser alteradas');

    const data = req.body.data ?? aula.data_iso;
    const inicio = req.body.hora_inicio ?? horaBanco(aula.hora_inicio);
    const fim = req.body.hora_fim ?? horaBanco(aula.hora_fim);
    const observacoes = typeof req.body.observacoes === 'string'
      ? req.body.observacoes.trim()
      : aula.observacoes;
    const problema = validarDados(data, inicio, fim, observacoes);
    if (problema) return erro(res, 400, problema);

    const destino = aula.turma_id
      ? await carregarDestino(req, aula.turma_id, null)
      : await carregarDestino(req, null, aula.grupo_id);
    const participantes = await idsDosParticipantes(destino);
    const conflito = await verificarConflitos({
      data, inicio, fim, responsavelId: aula.responsavel_id,
      turmaId: aula.turma_id, participantes, ignorarId: aula.id
    });
    if (conflito) return erro(res, 409, conflito);

    await pool.query(`
      UPDATE aula
      SET data = $1, hora_inicio = $2, hora_fim = $3, observacoes = $4
      WHERE id = $5 AND status = 'agendada'
    `, [data, inicio, fim, observacoes || null, aula.id]);
    res.json({ status: 'ok', dados: await buscarAula(aula.id) });
  } catch (e) {
    erro(res, e.status || 500, e.status ? e.message : 'Falha ao atualizar a aula', e.status ? undefined : e.message);
  }
}

async function destinatariosCancelamento(aulaId) {
  const resultado = await pool.query(`
    SELECT DISTINCT u.email, u.nome
    FROM usuario u
    JOIN aluno a ON a.usuario_id = u.id
    JOIN matricula m ON m.aluno_id = a.id
    JOIN aula au ON au.turma_id = m.turma_id
    WHERE au.id = $1 AND u.ativo = true
    UNION
    SELECT DISTINCT u.email, u.nome
    FROM usuario u
    JOIN aluno a ON a.usuario_id = u.id
    JOIN grupo_membro gm ON gm.aluno_id = a.id
    JOIN aula au ON au.grupo_id = gm.grupo_id
    WHERE au.id = $1 AND u.ativo = true
    UNION
    SELECT u.email, u.nome
    FROM usuario u
    WHERE u.perfil = 'admin' AND u.ativo = true
    ORDER BY email
  `, [aulaId]);
  return resultado.rows;
}

async function enviarAvisos(aula, destinatarios, motivo) {
  if (destinatarios.length === 0) return { enviados: 0, falharam: 0 };
  try {
    const resultados = await Promise.allSettled(destinatarios.map((destinatario) =>
      enviarAvisoCancelamentoAula({
        email: destinatario.email,
        nome: destinatario.nome,
        aula,
        motivo
      })
    ));
    const falharam = resultados.filter((resultado) => resultado.status === 'rejected').length;
    if (falharam > 0) console.error(`Falha ao enviar ${falharam} aviso(s) de cancelamento`);
    return { enviados: resultados.length - falharam, falharam };
  } catch (e) {
    console.error('Falha ao preparar avisos de cancelamento:', e.message);
    return { enviados: 0, falharam: destinatarios.length };
  }
}

async function cancelar(req, res) {
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  if (motivo.length > 500) return erro(res, 400, 'O motivo pode ter no máximo 500 caracteres');
  try {
    const aula = await carregarAulaComPermissoes(req.params.id);
    if (!aula) return erro(res, 404, 'Aula não encontrada');
    const professorId = req.usuario.perfil === 'admin' ? null : await carregarProfessor(req);
    if (!(await acessoProfessorAula(req, aula, professorId))) {
      return erro(res, 403, 'Você não pode cancelar esta aula');
    }
    if (aula.status !== 'agendada') return erro(res, 409, 'Esta aula não está agendada');

    const limite = await pool.query(`
      SELECT (data + hora_inicio) >=
        ((CURRENT_TIMESTAMP AT TIME ZONE current_setting('TIMEZONE')) + INTERVAL '${HORAS_CANCELAMENTO} hours') AS permitido
      FROM aula WHERE id = $1
    `, [aula.id]);
    if (req.usuario.perfil !== 'admin' && !limite.rows[0]?.permitido) {
      return erro(res, 409, 'O professor precisa cancelar a aula com pelo menos 6 horas de antecedência');
    }

    const atualizada = await pool.query(`
      UPDATE aula
      SET status = 'cancelada', cancelada_em = CURRENT_TIMESTAMP,
          cancelada_por = $1, motivo_cancelamento = $2
      WHERE id = $3 AND status = 'agendada'
      RETURNING id
    `, [req.usuario.id, motivo || null, aula.id]);
    if (atualizada.rows.length === 0) return erro(res, 409, 'A aula já foi alterada por outra operação');

    const aulaAtualizada = await buscarAula(aula.id);
    const destinatarios = await destinatariosCancelamento(aula.id);
    const avisos = await enviarAvisos(aulaAtualizada, destinatarios, motivo);
    res.json({
      status: 'ok',
      message: 'Aula cancelada. Os avisos foram processados.',
      dados: aulaAtualizada,
      avisos
    });
  } catch (e) {
    erro(res, e.status || 500, e.status ? e.message : 'Falha ao cancelar a aula', e.status ? undefined : e.message);
  }
}

module.exports = { listar, criar, atualizar, cancelar };
