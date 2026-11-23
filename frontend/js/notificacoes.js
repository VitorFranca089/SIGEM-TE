// Tela de notificacoes (RF09): lista os avisos do usuario logado e, depois de
// mostrar, marca todos como lidos.
//
// A ordem importa: a lista e pedida ANTES de marcar. Assim as que chegaram
// desde a ultima visita aparecem destacadas como "Nova" nesta visita, e so na
// proxima passam a aparecer como lidas.

const API_URL = '/api/notificacoes';

const avisoNotificacoes = document.getElementById('aviso-notificacoes');
const blocoNotificacoes = document.getElementById('bloco-notificacoes');
const listaNotificacoes = document.getElementById('lista-notificacoes');
const mensagemNotificacoes = document.getElementById('mensagem');

function mostrarMensagemNotificacoes(texto, tipo) {
  mensagemNotificacoes.textContent = texto;
  mensagemNotificacoes.className = 'mensagem ' + tipo;
}

function itemNotificacao(notificacao) {
  const item = document.createElement('li');
  if (!notificacao.lida) item.classList.add('notificacao-nova');

  // textContent e nao innerHTML: a mensagem leva o nome do arquivo e o nome de
  // quem enviou, que sao dados que alguem digitou.
  const texto = document.createElement('p');
  texto.textContent = notificacao.mensagem;

  const detalhe = document.createElement('p');
  detalhe.className = 'notificacao-data';
  detalhe.textContent = (notificacao.lida ? '' : 'Nova · ') + notificacao.criada_em;

  item.append(texto, detalhe);

  // Todo aviso de hoje e sobre um arquivo, e o arquivo se abre na tela de
  // Arquivos, que ja confere quem pode ver o que.
  if (notificacao.arquivo_id) {
    const link = document.createElement('a');
    link.href = 'arquivos.html';
    link.textContent = 'Ver em Arquivos →';
    item.appendChild(link);
  }
  return item;
}

async function marcarComoLidas() {
  try {
    await fetch(API_URL + '/lidas', { method: 'PATCH', headers: Sessao.cabecalho() });
  } catch (e) {
    // Sem marcar, o contador da barra continua com o numero antigo. Nao vale
    // uma mensagem de erro: a lista ja esta na tela, que era o que importava.
  }
}

async function carregarNotificacoes() {
  if (!Sessao.usuario()) {
    avisoNotificacoes.hidden = false;
    avisoNotificacoes.textContent = 'Entre no sistema para ver as suas notificações.';
    return;
  }

  try {
    const resposta = await fetch(API_URL, { headers: Sessao.cabecalho() });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      if (resposta.status === 401) window.location.href = 'login.html';
      mostrarMensagemNotificacoes(corpo.message || 'Não foi possível carregar as notificações.', 'erro');
      return;
    }

    if (corpo.dados.length === 0) {
      mostrarMensagemNotificacoes('Nenhuma notificação por enquanto.', 'sucesso');
      return;
    }

    corpo.dados.forEach((notificacao) => listaNotificacoes.appendChild(itemNotificacao(notificacao)));
    blocoNotificacoes.hidden = false;
    if (corpo.nao_lidas > 0) await marcarComoLidas();
  } catch (e) {
    mostrarMensagemNotificacoes('Não foi possível conectar ao servidor.', 'erro');
  }
}

carregarNotificacoes();
