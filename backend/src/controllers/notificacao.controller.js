// Controller de notificacoes (RF09): cada usuario le e marca as proprias.
//
// Quem cria notificacao e o controller de arquivos (envio de material, envio
// de pratica, primeiro download), pelo utils/notificacoes.js. Aqui so se le.

const pool = require('../config/db');

function erro(res, status, message, detalhe) {
  return res.status(status).json({ status: 'erro', message, detalhe });
}

// Quantas a tela mostra. As antigas continuam no banco; a lista e para saber
// o que aconteceu de novo, e nao um historico completo.
const LIMITE_DA_LISTA = 30;

// GET /api/notificacoes -> as mais recentes do usuario, e quantas nao lidas
//
// O usuario vem sempre do token, nunca da URL: nao existe "ver as notificacoes
// de outra pessoa", nem para o admin. A contagem vai junto porque e o que a
// barra lateral de toda tela precisa, e assim ela faz um pedido so.
async function listar(req, res) {
  try {
    const lista = await pool.query(`
      SELECT id, mensagem, arquivo_id, lida,
             TO_CHAR(criada_em, 'DD/MM/YYYY HH24:MI') AS criada_em
      FROM notificacao
      WHERE usuario_id = $1
      -- Com o nome da tabela na frente: "criada_em" sozinho seria o texto do
      -- TO_CHAR acima, e "31/01" viria antes de "01/02" em ordem de texto.
      ORDER BY notificacao.criada_em DESC, id DESC
      LIMIT $2
    `, [req.usuario.id, LIMITE_DA_LISTA]);

    // A contagem e separada da lista porque pode passar do limite: com 40 nao
    // lidas, a lista mostra 30, mas o numero na barra tem que dizer 40.
    const naoLidas = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM notificacao
      WHERE usuario_id = $1 AND lida = false
    `, [req.usuario.id]);

    res.json({ status: 'ok', dados: lista.rows, nao_lidas: naoLidas.rows[0].total });
  } catch (e) {
    erro(res, 500, 'Falha ao listar as notificações', e.message);
  }
}

// PATCH /api/notificacoes/lidas -> marca todas as do usuario como lidas
//
// Todas de uma vez, e nao uma por uma: a tela de notificacoes mostra a lista
// inteira, entao abrir a tela e ter lido. E menos um botao para o usuario
// lembrar de clicar.
async function marcarLidas(req, res) {
  try {
    const resultado = await pool.query(`
      UPDATE notificacao SET lida = true
      WHERE usuario_id = $1 AND lida = false
    `, [req.usuario.id]);
    res.json({ status: 'ok', marcadas: resultado.rowCount });
  } catch (e) {
    erro(res, 500, 'Falha ao marcar as notificações como lidas', e.message);
  }
}

module.exports = { listar, marcarLidas };
