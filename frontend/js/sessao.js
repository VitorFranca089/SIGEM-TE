// Sessao do usuario logado (RF06), compartilhada por todas as telas.
//
// Faz duas coisas:
//   1. guarda e le o token no navegador, num lugar so;
//   2. desenha sozinha a barra "Logado como ..." no cabecalho de quem incluir
//      este script - a mesma ideia do rodape.js, que monta o rodape sem exigir
//      HTML nenhum. Assim as telas que ja existiam mudaram uma linha cada, e o
//      <nav> delas nao precisou ser tocado.
//
// Tudo dentro de uma IIFE (funcao que roda sozinha ao ser definida) porque este
// script e incluido em MAIS DE UMA tela, ao lado de main.js, alunos.js e do
// professores.js que esta por vir - e cada um deles declara sua propria
// constante API_URL. Scripts sem type="module" compartilham um unico espaco de
// nomes global: sem a IIFE, "const API_URL" aqui colidiria com a deles e
// quebraria a pagina inteira com um SyntaxError silencioso. A mesma protecao
// que o rodape.js usa, pelo mesmo motivo.
//
// O que sai daqui para fora e um objeto so: window.Sessao.
(function () {

// sessionStorage e nao localStorage: o token morre quando a aba fecha.
//
// O motivo e o cenario real do SIGEM - o computador da secretaria da escola,
// usado por mais de uma pessoa. Com localStorage, quem esquecesse a aba aberta
// deixaria a sessao viva para o proximo que sentasse ali, mesmo depois de
// fechar o navegador. Os dois tem exatamente a mesma interface, entao trocar
// e uma palavra se a decisao mudar.
const CHAVE_TOKEN = 'sigem_token';
const CHAVE_USUARIO = 'sigem_usuario';
const CHAVE_TEMA = 'sigem_tema';
const CHAVE_CONTRASTE = 'sigem_contraste';

function salvar(token, usuario) {
  sessionStorage.setItem(CHAVE_TOKEN, token);
  sessionStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

function token() {
  return sessionStorage.getItem(CHAVE_TOKEN);
}

function usuario() {
  const guardado = sessionStorage.getItem(CHAVE_USUARIO);
  if (!guardado) return null;
  try {
    return JSON.parse(guardado);
  } catch (e) {
    // Conteudo corrompido (alguem mexeu no armazenamento a mao, por exemplo).
    // Tratar como "nao logado" em vez de deixar a excecao subir e quebrar a tela.
    return null;
  }
}

function encerrar() {
  sessionStorage.removeItem(CHAVE_TOKEN);
  sessionStorage.removeItem(CHAVE_USUARIO);
}

function aplicarPreferenciasVisuais() {
  const modoNoturno = localStorage.getItem(CHAVE_TEMA) === 'dark';
  const altoContraste = localStorage.getItem(CHAVE_CONTRASTE) === 'on';
  document.body.classList.toggle('modo-noturno', modoNoturno);
  document.body.classList.toggle('alto-contraste', altoContraste);

  const botaoNoturno = document.querySelector('[data-theme-toggle="dark"]');
  const botaoContraste = document.querySelector('[data-theme-toggle="contrast"]');

  if (botaoNoturno) {
    botaoNoturno.setAttribute('aria-pressed', String(modoNoturno));
    botaoNoturno.addEventListener('click', () => {
      const ativar = !document.body.classList.contains('modo-noturno');
      document.body.classList.toggle('modo-noturno', ativar);
      localStorage.setItem(CHAVE_TEMA, ativar ? 'dark' : 'light');
      botaoNoturno.setAttribute('aria-pressed', String(ativar));
    });
  }

  if (botaoContraste) {
    botaoContraste.setAttribute('aria-pressed', String(altoContraste));
    botaoContraste.addEventListener('click', () => {
      const ativar = !document.body.classList.contains('alto-contraste');
      document.body.classList.toggle('alto-contraste', ativar);
      localStorage.setItem(CHAVE_CONTRASTE, ativar ? 'on' : 'off');
      botaoContraste.setAttribute('aria-pressed', String(ativar));
    });
  }
}

// Devolve o cabecalho de autorizacao pronto para espalhar dentro de um fetch:
//
//   headers: { 'Content-Type': 'application/json', ...Sessao.cabecalho() }
//
// Quando nao ha token, devolve objeto vazio - o espalhamento nao acrescenta
// nada e a requisicao sai sem o cabecalho, que e o certo. E esta funcao que a
// Etapa 4 vai usar em todas as telas quando as rotas forem fechadas.
function cabecalho() {
  const guardado = token();
  return guardado ? { Authorization: 'Bearer ' + guardado } : {};
}

// Nomes legiveis para o perfil. O banco guarda 'admin', que fica seco na tela.
const NOME_DO_PERFIL = {
  admin: 'Administrador',
  professor: 'Professor',
  aluno: 'Aluno'
};

function desenharBarra() {
  // A tela de login marca o proprio body com data-tela-login: mostrar um botao
  // "Entrar" dentro da tela de entrar nao faria sentido nenhum.
  if (
    document.body.hasAttribute('data-tela-login') ||
    document.body.hasAttribute('data-ocultar-sessao')
  ) return;

  const cabecalhoPagina = document.querySelector('header');
  if (!cabecalhoPagina) return;

  const barra = document.createElement('div');
  barra.className = 'barra-sessao';

  const logado = usuario();

  if (!logado) {
    const entrar = document.createElement('a');
    entrar.href = 'login.html';
    entrar.className = 'entrar-sistema';
    entrar.textContent = 'Entrar';
    barra.appendChild(entrar);
  } else {
    const identificacao = document.createElement('span');
    identificacao.className = 'usuario-logado';
    // textContent e nao innerHTML: o nome vem do banco, e nome de usuario e
    // dado que alguem digitou. Mesmo cuidado das tabelas de aluno.
    identificacao.textContent =
      logado.nome + ' (' + (NOME_DO_PERFIL[logado.perfil] || logado.perfil) + ')';

    const sair = document.createElement('button');
    sair.type = 'button';
    sair.className = 'secundario';
    sair.textContent = 'Sair';
    sair.addEventListener('click', () => {
      encerrar();
      window.location.href = 'login.html';
    });

    barra.append(identificacao, sair);
  }

  cabecalhoPagina.appendChild(barra);
}

// Links de gestao de cada perfil: [endereco, icone, texto]. A barra lateral de
// cada tela e escrita a mao no HTML e e a mesma para qualquer visitante; o que
// muda com o perfil fica aqui, num lugar so, em vez de repetido em cada tela.
// Esconder um link NAO e seguranca: quem barra de verdade e a API (401 e 403).
// Isto e so navegacao.
const MENU_DO_PERFIL = {
  admin: [
    ['alunos.html', '☺', 'Alunos'],
    ['professores.html', '✎', 'Professores'],
    ['cursos.html', '▤', 'Cursos'],
    ['turmas.html', '▦', 'Turmas'],
    ['agenda.html', '◷', 'Agenda'],
    ['chamada.html', '✓', 'Chamada'],
    ['arquivos.html', '♪', 'Arquivos'],
    ['notificacoes.html', '✉', 'Notificações']
  ],
  professor: [
    ['turmas.html', '▦', 'Turmas'],
    ['agenda.html', '◷', 'Agenda'],
    ['chamada.html', '✓', 'Chamada'],
    ['arquivos.html', '♪', 'Arquivos'],
    ['notificacoes.html', '✉', 'Notificações']
  ],
  aluno: [
    ['agenda.html', '◷', 'Agenda'],
    ['arquivos.html', '♪', 'Arquivos'],
    ['notificacoes.html', '✉', 'Notificações']
  ]
};

function desenharMenuDoPerfil() {
  const logado = usuario();
  const barraLateral = document.querySelector('header.sidebar');
  if (!logado || !barraLateral) return;

  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';
  const paginaAtual = window.location.pathname.split('/').pop() || 'index.html';

  (MENU_DO_PERFIL[logado.perfil] || []).forEach(([endereco, icone, texto]) => {
    // Algumas telas ja trazem "Agenda" escrito no HTML; nao repete o link.
    if (barraLateral.querySelector('a[href="' + endereco + '"]')) return;
    const link = document.createElement('a');
    link.href = endereco;
    const simbolo = document.createElement('span');
    simbolo.textContent = icone;
    link.append(simbolo, texto);
    if (endereco === paginaAtual) {
      // So um link aceso por vez: a tela atual e esta, nao a do HTML.
      barraLateral.querySelectorAll('a.ativo').forEach((a) => a.classList.remove('ativo'));
      link.classList.add('ativo');
    }
    nav.appendChild(link);
  });
  if (!nav.children.length) return;

  const titulo = document.createElement('p');
  titulo.className = 'sidebar-heading';
  titulo.textContent = 'Gestão';
  // Entra antes de "Sua conta", no fim das secoes de navegacao.
  barraLateral.insertBefore(titulo, barraLateral.querySelector('.sidebar-tools'));
  barraLateral.insertBefore(nav, barraLateral.querySelector('.sidebar-tools'));

  const linkNotificacoes = nav.querySelector('a[href="notificacoes.html"]');
  // Na propria tela de notificacoes o contador nao aparece: ela marca tudo
  // como lido ao abrir, e um numero pedido antes disso ficaria velho na tela.
  if (linkNotificacoes && paginaAtual !== 'notificacoes.html') {
    mostrarContadorDeNotificacoes(linkNotificacoes);
  }
}

// RF09: o numero de notificacoes nao lidas, ao lado do link. E o "tiquezinho"
// que o professor ve quando o aluno abre o material, em qualquer tela.
// Endereco relativo, como o das telas: a CSP so deixa chamar o proprio
// servidor. Qualquer falha (servidor fora, sessao vencida) so deixa o link
// sem numero - e navegacao, e nao pode quebrar a tela que incluiu o script.
function mostrarContadorDeNotificacoes(link) {
  fetch('/api/notificacoes', { headers: cabecalho() })
    .then((resposta) => (resposta.ok ? resposta.json() : null))
    .then((corpo) => {
      if (!corpo || !corpo.nao_lidas) return;
      const contador = document.createElement('b');
      contador.className = 'contador-notificacoes';
      contador.textContent = corpo.nao_lidas > 99 ? '99+' : String(corpo.nao_lidas);
      // O leitor de tela le "3" solto como "tres", sem dizer tres o que.
      contador.setAttribute('aria-label', corpo.nao_lidas + ' não lidas');
      link.appendChild(contador);
    })
    .catch(() => {});
}

window.Sessao = { salvar, token, usuario, encerrar, cabecalho };

desenharBarra();
desenharMenuDoPerfil();
aplicarPreferenciasVisuais();

})();
