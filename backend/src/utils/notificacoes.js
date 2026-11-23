// Gravacao das notificacoes do RF09, usada pelo controller de arquivos.
//
// Fica fora do controller de notificacoes porque quem CRIA notificacao e o
// envio e o download de arquivos; o controller de notificacoes so lista e
// marca como lida.

const pool = require('../config/db');

// A coluna mensagem aceita ate 500 caracteres. Nome de arquivo pode ter 255 e
// nome de pessoa 150: somados ao texto fixo, quase nunca passam, mas cortar
// aqui evita que um nome longo derrube a gravacao inteira.
const TAMANHO_MAXIMO_MENSAGEM = 500;

// Grava a mesma mensagem para varios usuarios numa consulta so. O unnest
// transforma a lista de ids em linhas, uma por destinatario.
//
// Nunca lanca erro, de proposito. A notificacao e consequencia do envio ou do
// download, e nao parte deles: se gravar o aviso falhar, o material ja esta
// enviado e o arquivo ja esta sendo baixado. Desfazer isso por causa do aviso
// seria trocar um problema pequeno por um grande. A falha fica no log do
// servidor.
async function notificar(usuarioIds, mensagem, arquivoId) {
  if (usuarioIds.length === 0) return;
  try {
    await pool.query(`
      INSERT INTO notificacao (usuario_id, mensagem, arquivo_id)
      SELECT unnest($1::int[]), $2, $3
    `, [usuarioIds, mensagem.slice(0, TAMANHO_MAXIMO_MENSAGEM), arquivoId]);
  } catch (e) {
    console.error('Falha ao gravar notificação:', e.message);
  }
}

module.exports = { notificar };
