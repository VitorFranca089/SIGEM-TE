// Tela de chamada (RF05). Sem framework, conforme o RNF02.
//
// So administrador e professor fazem chamada. A tela tem duas partes: em cima,
// as aulas de turma recentes; embaixo, os alunos da aula escolhida, com
// presenca ou falta para cada um.
//
// Tela propria, e nao um botao dentro da Agenda, porque a Agenda lista de hoje
// em diante: a chamada esquecida de ontem sumiria dela. Decidido em 23/09; o
// porque completo esta no GUIA-DA-BANCA.md.
//
// A tela NAO decide se a chamada ja abriu. Quem responde e o campo
// chamada_aberta da API. Repetir a conta do horario aqui criaria duas regras
// que podem discordar - o relogio do navegador nao e o do servidor.

// Endereco relativo: a CSP do servidor so deixa a tela chamar o proprio endereco.
const API_URL = '/api';

// Onde a lista comeca ao abrir a tela. Decidido em 23/09: a chamada esquecida
// costuma ser da mesma semana, e uma janela maior deixa a lista longa. O campo
// "Aulas a partir de" deixa ir mais para tras - a chamada nao fecha nunca.
const DIAS_PARA_TRAS = 7;

const blocoSemLogin = document.getElementById('bloco-sem-login');
const blocoSoProfessor = document.getElementById('bloco-so-professor');
const blocoAulas = document.getElementById('bloco-aulas');
const filtroInicio = document.getElementById('filtro-inicio');
const listaAulas = document.getElementById('lista-aulas');
const mensagemAulas = document.getElementById('mensagem-aulas');
const blocoChamada = document.getElementById('bloco-chamada');
const chamadaCurso = document.getElementById('chamada-curso');
const chamadaTurma = document.getElementById('chamada-turma');
const chamadaData = document.getElementById('chamada-data');
const avisoChamada = document.getElementById('aviso-chamada');
const formularioChamada = document.getElementById('formulario-chamada');
const listaChamada = document.getElementById('lista-chamada');
const botaoSalvar = document.getElementById('botao-salvar');
const mensagemChamada = document.getElementById('mensagem-chamada');

const usuarioLogado = Sessao.usuario();

// A aula aberta embaixo da lista. O botao de salvar precisa saber qual e.
let aulaAberta = null;

// Data no fuso do navegador, no formato do banco (AAAA-MM-DD). Nao da para
// usar toISOString(): ele converte para UTC, e depois das 21h no Brasil ja
// devolveria o dia seguinte.
function dataLocal(offsetDias = 0) {
  const data = new Date();
  data.setDate(data.getDate() + offsetDias);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// O T12:00 evita que a data "volte um dia": sem hora, o navegador le
// "2026-09-22" como meia-noite em UTC, que no Brasil ainda e dia 21.
function formatarData(data) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date(`${data}T12:00:00`));
}

function descreverHorario(aula) {
  return `${formatarData(aula.data)} · ${aula.hora_inicio} - ${aula.hora_fim}`;
}

function mostrarMensagem(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = 'mensagem ' + tipo;
}

// Erro lancado quando a sessao acabou e a tela ja esta indo para o login: os
// catch reconhecem e ficam quietos. Mesmo padrao do arquivos.js.
class SessaoEncerrada extends Error {}

function falhaDeConexao(elemento, e) {
  if (e instanceof SessaoEncerrada) return;
  mostrarMensagem(elemento, 'Não foi possível falar com o backend. Ele está rodando?', 'erro');
}

// Toda chamada desta tela passa por aqui, para o token ir sempre junto e o 401
// ser tratado num lugar so. 403 nao manda para o login: entrar de novo
// devolveria o mesmo perfil, entao so a mensagem aparece.
async function chamarApi(caminho, opcoes = {}) {
  const resposta = await fetch(API_URL + caminho, {
    ...opcoes,
    headers: {
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      ...Sessao.cabecalho()
    }
  });
  if (resposta.status === 401) {
    Sessao.encerrar();
    window.location.href = 'login.html';
    throw new SessaoEncerrada();
  }
  const corpo = await resposta.json().catch(() => ({}));
  return { resposta, corpo };
}

function criarCartaoAula(aula) {
  const cartao = document.createElement('article');
  cartao.className = 'cartao agenda-card';

  const curso = document.createElement('p');
  curso.className = 'overline';
  curso.textContent = aula.curso_nome || 'Turma';

  // textContent em tudo que vem do banco: nome de turma e dado que alguem digitou.
  const titulo = document.createElement('h3');
  titulo.textContent = aula.turma_nome;

  const horario = document.createElement('p');
  horario.className = 'agenda-data';
  horario.textContent = descreverHorario(aula);

  // So a chamada muda uma aula para 'realizada', entao as duas coisas sao a
  // mesma: realizada = chamada feita.
  const feita = aula.status === 'realizada';
  const situacao = document.createElement('span');
  situacao.className = `agenda-status ${feita ? 'status-realizada' : 'status-pendente'}`;
  situacao.textContent = feita ? 'Chamada feita' : 'Sem chamada';

  const acoes = document.createElement('div');
  acoes.className = 'agenda-acoes';
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'pequeno';
  botao.textContent = feita ? 'Ver chamada' : 'Fazer chamada';
  botao.addEventListener('click', () => abrirChamada(aula.id));
  acoes.appendChild(botao);

  cartao.append(curso, titulo, horario, situacao, acoes);
  return cartao;
}

async function carregarAulas() {
  mostrarMensagem(mensagemAulas, '', '');
  // A lista vai so ate hoje: aula de amanha ainda nao tem chamada. A de hoje
  // entra mesmo que ainda nao tenha comecado; ao abrir, a API avisa o horario.
  const inicio = filtroInicio.value || dataLocal(-DIAS_PARA_TRAS);
  const parametros = new URLSearchParams({ inicio, fim: dataLocal() });
  try {
    // A mesma rota da Agenda (RF04), so com outras datas. Ela ja entrega ao
    // professor apenas as aulas dele - as mesmas em que a API da chamada
    // deixa ele entrar.
    const { resposta, corpo } = await chamarApi('/aulas?' + parametros);
    if (!resposta.ok) return mostrarMensagem(mensagemAulas, corpo.message, 'erro');

    // So aula de turma tem chamada, e aula cancelada nao tem. O filtro fica
    // aqui para nao mudar uma rota que a Agenda usa. O reverse() poe a aula
    // mais recente em cima: a agenda vem da mais antiga para a mais nova.
    const aulas = corpo.dados
      .filter((aula) => aula.turma_id && aula.status !== 'cancelada')
      .reverse();

    listaAulas.replaceChildren();
    if (aulas.length === 0) {
      const vazio = document.createElement('section');
      vazio.className = 'cartao empty-state';
      vazio.innerHTML = '<span>✓</span><h3>Nenhuma aula de turma nesse periodo</h3><p>Escolha uma data mais antiga em "Aulas a partir de".</p>';
      listaAulas.appendChild(vazio);
      return;
    }
    aulas.forEach((aula) => listaAulas.appendChild(criarCartaoAula(aula)));
  } catch (e) {
    falhaDeConexao(mensagemAulas, e);
  }
}

// Duas opcoes por aluno, e nao uma caixa "presente": a caixa desmarcada nao
// distinguiria "faltou" de "ainda nao marquei", e a API guarda os dois
// separados (presente = null e "sem registro", nao falta). Aluno sem nenhuma
// opcao marcada fica fora do envio e continua sem registro.
function criarLinhaAluno(aluno, aberta) {
  const item = document.createElement('li');

  const nome = document.createElement('span');
  nome.textContent = aluno.nome;

  const opcoes = document.createElement('div');
  opcoes.className = 'opcoes-presenca';
  opcoes.setAttribute('role', 'radiogroup');
  opcoes.setAttribute('aria-label', 'Presença de ' + aluno.nome);

  [[true, 'Presente'], [false, 'Falta']].forEach(([valor, texto]) => {
    const rotulo = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    // O mesmo name agrupa as duas opcoes do aluno: marcar uma desmarca a outra.
    radio.name = 'presenca-' + aluno.aluno_id;
    radio.value = String(valor);
    radio.dataset.alunoId = aluno.aluno_id;
    radio.checked = aluno.presente === valor;
    radio.disabled = !aberta;
    rotulo.append(radio, texto);
    opcoes.appendChild(rotulo);
  });

  item.append(nome, opcoes);
  return item;
}

function desenharChamada(chamada) {
  const { aula, alunos } = chamada;
  aulaAberta = aula;

  chamadaCurso.textContent = aula.curso_nome || 'Turma';
  chamadaTurma.textContent = aula.turma_nome;
  chamadaData.textContent = descreverHorario(aula);

  // Fechada, a lista aparece so para leitura, com o motivo em cima.
  const aberta = aula.chamada_aberta;
  avisoChamada.hidden = aberta;
  if (!aberta) {
    avisoChamada.textContent = aula.status === 'cancelada'
      ? 'Esta aula foi cancelada e não tem chamada.'
      : `A chamada desta aula abre no horário de início (${aula.hora_inicio}).`;
  }

  listaChamada.replaceChildren();
  if (alunos.length === 0) {
    const vazio = document.createElement('li');
    vazio.textContent = 'Nenhum aluno matriculado nesta turma. Matricule pela tela de Turmas.';
    listaChamada.appendChild(vazio);
    botaoSalvar.hidden = true;
    return;
  }
  botaoSalvar.hidden = false;
  botaoSalvar.disabled = !aberta;
  alunos.forEach((aluno) => listaChamada.appendChild(criarLinhaAluno(aluno, aberta)));
}

async function abrirChamada(aulaId) {
  mostrarMensagem(mensagemAulas, '', '');
  mostrarMensagem(mensagemChamada, '', '');
  try {
    const { resposta, corpo } = await chamarApi('/frequencia/aulas/' + aulaId);
    if (!resposta.ok) {
      blocoChamada.hidden = true;
      aulaAberta = null;
      return mostrarMensagem(mensagemAulas, corpo.message, 'erro');
    }
    desenharChamada(corpo.dados);
    blocoChamada.hidden = false;
    blocoChamada.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    falhaDeConexao(mensagemAulas, e);
  }
}

formularioChamada.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!aulaAberta) return;

  const presencas = [...listaChamada.querySelectorAll('input[type="radio"]:checked')].map((radio) => ({
    aluno_id: Number(radio.dataset.alunoId),
    presente: radio.value === 'true'
  }));
  // A API recusaria a lista vazia do mesmo jeito; o aviso aqui so poupa a viagem.
  if (presencas.length === 0) {
    return mostrarMensagem(mensagemChamada, 'Marque presença ou falta de pelo menos um aluno.', 'erro');
  }

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = 'Salvando...';
  try {
    const { resposta, corpo } = await chamarApi('/frequencia/aulas/' + aulaAberta.id, {
      method: 'PUT',
      body: JSON.stringify({ presencas })
    });
    if (!resposta.ok) return mostrarMensagem(mensagemChamada, corpo.message, 'erro');

    // A API devolve a chamada relida do banco. Se so a releitura falhou, a
    // chamada foi gravada mesmo assim e vem sem "dados" (ver o controller):
    // nesse caso a tela mantem o que a pessoa marcou.
    let texto = 'Chamada salva.';
    if (corpo.dados) {
      desenharChamada(corpo.dados);
      // Salvar com alguem sem marcar e permitido (corrigir um aluno so, por
      // exemplo), mas avisar evita esquecer alguem sem perceber.
      const semRegistro = corpo.dados.alunos.filter((aluno) => aluno.presente === null).length;
      if (semRegistro > 0) texto += ` ${semRegistro} aluno(s) ainda sem registro.`;
    }
    mostrarMensagem(mensagemChamada, texto, 'sucesso');
    // A aula passa de "Sem chamada" para "Chamada feita" na lista de cima.
    carregarAulas();
  } catch (e) {
    falhaDeConexao(mensagemChamada, e);
  } finally {
    botaoSalvar.disabled = !(aulaAberta && aulaAberta.chamada_aberta);
    botaoSalvar.textContent = 'Salvar chamada';
  }
});

document.getElementById('botao-filtrar').addEventListener('click', carregarAulas);

// Decide o que a tela mostra. Esconder nao e seguranca - a API recusa o aluno
// com 403 do mesmo jeito -, e so para nao oferecer o que daria erro.
if (!usuarioLogado) {
  blocoSemLogin.hidden = false;
} else if (!['admin', 'professor'].includes(usuarioLogado.perfil)) {
  blocoSoProfessor.hidden = false;
} else {
  filtroInicio.value = dataLocal(-DIAS_PARA_TRAS);
  // Nao ha chamada de aula futura; o limite so evita escolher uma data inutil.
  filtroInicio.max = dataLocal();
  blocoAulas.hidden = false;
  carregarAulas();
}
