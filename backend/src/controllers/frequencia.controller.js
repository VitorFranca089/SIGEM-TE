// Controller do RF05 - frequencia (a chamada) dos alunos por aula.
//
// Regras decididas em 23/09 (o porque de cada uma esta no GUIA-DA-BANCA.md):
// - so aula de TURMA tem chamada. Grupo extracurricular fica so na agenda,
//   como o TCC descreve;
// - a chamada abre no horario de inicio da aula e nao fecha: o professor pode
//   corrigir um engano depois;
// - salvar a chamada muda a aula para 'realizada'. O aula.controller so
//   remarca e cancela aula 'agendada', entao a aula fica travada na agenda.

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

// chamada_aberta e calculada aqui, e nao na tela, para a regra de horario
// morar num lugar so. LOCALTIMESTAMP e "agora" no fuso do banco, sem fuso -
// o mesmo tipo de data + hora_inicio, entao os dois comparam direto.
async function carregarAula(aulaId) {
  const resultado = await pool.query(`
    SELECT
      a.id, a.turma_id, a.grupo_id, t.nome AS turma_nome, c.nome AS curso_nome,
      a.data::text AS data, TO_CHAR(a.hora_inicio, 'HH24:MI') AS hora_inicio,
      TO_CHAR(a.hora_fim, 'HH24:MI') AS hora_fim, a.status,
      a.responsavel_id, t.professor_id AS turma_professor_id,
      (a.data + a.hora_inicio) <= LOCALTIMESTAMP AS ja_comecou
    FROM aula a
    LEFT JOIN turma t ON t.id = a.turma_id
    LEFT JOIN curso c ON c.id = t.curso_id
    WHERE a.id = $1
  `, [aulaId]);
  return resultado.rows[0] || null;
}

// O professor que pode remarcar ou cancelar a aula (aula.controller) e o
// mesmo que pode fazer a chamada: o responsavel pela aula ou o professor atual
// da turma. Os dois costumam ser a mesma pessoa; diferem se a turma trocar de
// professor depois de a aula ser marcada.
async function podeFazerChamada(req, aula) {
  if (req.usuario.perfil === 'admin') return true;
  const professorId = await professorDoUsuario(req.usuario.id);
  return Boolean(professorId && (
    aula.responsavel_id === professorId || aula.turma_professor_id === professorId
  ));
}

// Os mesmos passos abrem as duas rotas da chamada (ver e salvar): a aula
// existe, quem chamou tem acesso a ela e ela e de turma. Devolve a aula, ou
// ja responde com o erro e devolve null.
async function aulaDaChamada(req, res) {
  const aulaId = inteiroPositivo(req.params.aulaId);
  if (!aulaId) {
    erro(res, 400, 'Identificador de aula inválido');
    return null;
  }
  const aula = await carregarAula(aulaId);
  if (!aula) {
    erro(res, 404, 'Aula não encontrada');
    return null;
  }
  if (!(await podeFazerChamada(req, aula))) {
    erro(res, 403, 'Você não pode fazer a chamada desta aula');
    return null;
  }
  if (!aula.turma_id) {
    erro(res, 400, 'Encontro de grupo extracurricular não tem chamada');
    return null;
  }
  return aula;
}

// Quem aparece na chamada: os alunos ativos matriculados na turma, mais quem
// ja tem presenca gravada nesta aula. O segundo grupo existe para o historico
// nao sumir: se um aluno sair da turma, ou for desativado, depois da aula, a
// presenca dele continua aparecendo e pode ser corrigida.
// presente = null quer dizer "ainda sem registro", que e diferente de falta.
async function alunosDaChamada(aula) {
  const resultado = await pool.query(`
    SELECT al.id AS aluno_id, u.nome, f.presente
    FROM aluno al
    JOIN usuario u ON u.id = al.usuario_id
    LEFT JOIN frequencia f ON f.aluno_id = al.id AND f.aula_id = $1
    WHERE f.id IS NOT NULL
       OR (u.ativo = true AND EXISTS (
             SELECT 1 FROM matricula m
             WHERE m.turma_id = $2 AND m.aluno_id = al.id
           ))
    ORDER BY u.nome, al.id
  `, [aula.id, aula.turma_id]);
  return resultado.rows;
}

function montarChamada(aula, alunos) {
  return {
    aula: {
      id: aula.id,
      turma_id: aula.turma_id,
      turma_nome: aula.turma_nome,
      curso_nome: aula.curso_nome,
      data: aula.data,
      hora_inicio: aula.hora_inicio,
      hora_fim: aula.hora_fim,
      status: aula.status,
      chamada_aberta: aula.status !== 'cancelada' && aula.ja_comecou
    },
    alunos
  };
}

// Confere a lista enviada antes de abrir a transacao. Devolve a mensagem do
// primeiro problema, ou null se a lista estiver boa.
function validarPresencas(presencas, idsPermitidos) {
  if (!Array.isArray(presencas) || presencas.length === 0) {
    return 'Envie a lista de presenças';
  }
  const vistos = new Set();
  for (const item of presencas) {
    const alunoId = inteiroPositivo(item?.aluno_id);
    if (!alunoId) return 'Cada presença precisa de um aluno_id válido';
    // So true ou false. Aceitar "sim" ou 1 abriria espaco para uma tela
    // mandar qualquer coisa e o banco gravar um valor que ninguem quis.
    if (typeof item.presente !== 'boolean') return 'O campo presente precisa ser true ou false';
    if (vistos.has(alunoId)) return 'O mesmo aluno aparece duas vezes na lista';
    if (!idsPermitidos.has(alunoId)) return `O aluno ${alunoId} não faz parte desta turma`;
    vistos.add(alunoId);
  }
  return null;
}

// GET /api/frequencia/aulas/:aulaId -> a chamada de uma aula
async function verChamada(req, res) {
  try {
    const aula = await aulaDaChamada(req, res);
    if (!aula) return;
    const alunos = await alunosDaChamada(aula);
    res.json({ status: 'ok', dados: montarChamada(aula, alunos) });
  } catch (e) {
    erro(res, 500, 'Falha ao carregar a chamada', e.message);
  }
}

// PUT /api/frequencia/aulas/:aulaId -> grava ou corrige a chamada
//
// PUT, e nao POST, porque repetir a mesma chamada nao cria nada novo: grava
// o mesmo estado de novo. A lista pode trazer so parte da turma, para corrigir
// um aluno sem reenviar todos.
async function registrarChamada(req, res) {
  let aula;
  try {
    aula = await aulaDaChamada(req, res);
    if (!aula) return;
    if (aula.status === 'cancelada') return erro(res, 409, 'Aula cancelada não tem chamada');
    if (!aula.ja_comecou) return erro(res, 409, 'A chamada abre no horário de início da aula');

    const alunos = await alunosDaChamada(aula);
    const problema = validarPresencas(req.body.presencas, new Set(alunos.map((a) => a.aluno_id)));
    if (problema) return erro(res, 400, problema);
  } catch (e) {
    return erro(res, 500, 'Falha ao registrar a chamada', e.message);
  }

  // client() em vez de pool.query() porque BEGIN/COMMIT precisam rodar todos
  // na mesma conexao - o mesmo cuidado do aluno.controller.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // O UPDATE vem ANTES das presencas de proposito. Ele trava a linha da aula
    // ate o COMMIT: se alguem tentar cancelar a aula ao mesmo tempo, o
    // cancelamento espera, e depois encontra a aula ja 'realizada' e desiste.
    // Se o cancelamento chegou primeiro, este UPDATE nao acha a aula e nenhuma
    // presenca e gravada numa aula cancelada.
    const marcada = await client.query(`
      UPDATE aula SET status = 'realizada'
      WHERE id = $1 AND status <> 'cancelada'
      RETURNING id
    `, [aula.id]);
    if (marcada.rows.length === 0) {
      await client.query('ROLLBACK');
      return erro(res, 409, 'A aula foi cancelada enquanto a chamada era salva');
    }

    // ON CONFLICT usa o UNIQUE (aula_id, aluno_id) da tabela: a primeira vez
    // insere, as seguintes so trocam o presente. E o que permite corrigir.
    for (const item of req.body.presencas) {
      await client.query(`
        INSERT INTO frequencia (aula_id, aluno_id, presente)
        VALUES ($1, $2, $3)
        ON CONFLICT (aula_id, aluno_id) DO UPDATE SET presente = EXCLUDED.presente
      `, [aula.id, Number(item.aluno_id), item.presente]);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    return erro(res, 500, 'Falha ao registrar a chamada', e.message);
  } finally {
    // devolve a conexao ao pool. Sem isso o pool esgota e a API trava.
    client.release();
  }

  try {
    const atualizada = await carregarAula(aula.id);
    const alunos = await alunosDaChamada(atualizada);
    res.json({ status: 'ok', message: 'Chamada registrada', dados: montarChamada(atualizada, alunos) });
  } catch (e) {
    // A chamada ja foi gravada; so a releitura falhou. Responder 500 aqui
    // faria a tela achar que nada foi salvo.
    res.json({ status: 'ok', message: 'Chamada registrada' });
  }
}

// GET /api/frequencia/eu -> o aluno logado ve as proprias presencas e faltas
//
// So o que foi registrado. Sem porcentagem: totais por aluno sao o segundo
// corte da lista do ROADMAP.md (Secao 6), e ficam para depois.
async function minhaFrequencia(req, res) {
  try {
    const aluno = await pool.query('SELECT id FROM aluno WHERE usuario_id = $1', [req.usuario.id]);
    if (aluno.rows.length === 0) return erro(res, 403, 'Aluno não cadastrado');

    const resultado = await pool.query(`
      SELECT
        a.id AS aula_id, a.data::text AS data,
        TO_CHAR(a.hora_inicio, 'HH24:MI') AS hora_inicio,
        TO_CHAR(a.hora_fim, 'HH24:MI') AS hora_fim,
        t.nome AS turma_nome, c.nome AS curso_nome, f.presente
      FROM frequencia f
      JOIN aula a ON a.id = f.aula_id
      JOIN turma t ON t.id = a.turma_id
      JOIN curso c ON c.id = t.curso_id
      WHERE f.aluno_id = $1
      ORDER BY a.data DESC, a.hora_inicio DESC
    `, [aluno.rows[0].id]);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao carregar a sua frequência', e.message);
  }
}

module.exports = { verChamada, registrarChamada, minhaFrequencia };
