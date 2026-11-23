const listaClasses = document.getElementById('lista-classes');
const avisoPermissaoClasses = document.getElementById('aviso-permissao');
const mensagemClasses = document.getElementById('mensagem');
const secaoPresencas = document.getElementById('minhas-presencas');
const resumoPresencas = document.getElementById('resumo-presencas');
const listaPresencas = document.getElementById('lista-presencas');
const nomesDiasClasses = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function mostrarMensagemClasses(texto, tipo) {
  mensagemClasses.textContent = texto;
  mensagemClasses.className = 'mensagem ' + tipo;
}

function capaPadrao(turma) {
  const texto = `${turma.nome || ''} ${turma.curso_nome || ''}`.toLowerCase();
  if (texto.includes('violino')) return 'violino';
  if (texto.includes('violão') || texto.includes('violao')) return 'violao';
  if (texto.includes('guitarra')) return 'guitarra';
  if (texto.includes('canto') || texto.includes('voz')) return 'canto';
  if (texto.includes('bateria')) return 'bateria';
  if (texto.includes('teclado')) return 'teclado';
  if (texto.includes('piano')) return 'piano';
  return 'partitura';
}

// As duas partes da tela (classes e presencas) sao do aluno conectado. A
// conferencia fica aqui para o aviso aparecer uma vez so. Esconder a tela nao
// e seguranca: quem barra de verdade e a API, com 401 e 403.
function alunoConectado() {
  const usuario = Sessao.usuario();
  if (usuario && usuario.perfil === 'aluno') return true;
  avisoPermissaoClasses.hidden = false;
  avisoPermissaoClasses.textContent = usuario
    ? 'Esta área mostra as classes do aluno conectado.'
    : 'Entre no sistema para ver as classes em que está inscrito.';
  return false;
}

function cartaoClasse(turma) {
  const cartao = document.createElement('article');
  cartao.className = 'cartao student-class-card';
  const capa = document.createElement('div');
  capa.className = 'student-class-cover';
  const imagem = document.createElement('img');
  imagem.alt = `Capa da turma ${turma.nome}`;
  imagem.src = turma.capa_url || window.CAPAS_PEXELS?.[capaPadrao(turma)];
  imagem.style.objectPosition = `${turma.capa_pos_x ?? 50}% ${turma.capa_pos_y ?? 50}%`;
  imagem.style.transform = `scale(${turma.capa_zoom ?? 1})`;
  imagem.addEventListener('error', () => imagem.remove());
  capa.appendChild(imagem);
  cartao.appendChild(capa);
  const titulo = document.createElement('h3');
  titulo.textContent = turma.nome;
  const curso = document.createElement('p');
  curso.className = 'overline';
  curso.textContent = turma.curso_nome;
  const horario = document.createElement('p');
  horario.textContent = `${nomesDiasClasses[turma.dia_semana] || 'Dia a definir'} · ${turma.hora_inicio} às ${turma.hora_fim}`;
  const professor = document.createElement('p');
  professor.className = 'class-teacher';
  professor.textContent = `Docente: ${turma.professor_nome}`;
  const contato = document.createElement('a');
  contato.href = `mailto:${turma.professor_email}`;
  contato.textContent = 'Enviar e-mail →';
  cartao.append(curso, titulo, horario, professor, contato);
  return cartao;
}

async function carregarMinhasClasses() {
  try {
    const resposta = await fetch('/api/turmas/minhas', { headers: Sessao.cabecalho() });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      if (resposta.status === 401) window.location.href = 'login.html';
      mostrarMensagemClasses(corpo.message || 'Não foi possível carregar suas classes.', 'erro');
      return;
    }
    if (corpo.dados.length === 0) {
      listaClasses.innerHTML = '<section class="cartao empty-state"><span>♫</span><h3>Você ainda não está inscrito em uma classe</h3><p>Use a pesquisa para conhecer novas aulas e cursos.</p><a class="page-cta" href="pesquisa.html">Pesquisar aulas</a></section>';
      return;
    }
    corpo.dados.forEach((turma) => listaClasses.appendChild(cartaoClasse(turma)));
  } catch (erro) {
    mostrarMensagemClasses('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  }
}

// ---------- Minhas presencas (RF05) ----------

// O T12:00 evita que a data "volte um dia": sem hora, o navegador le
// "2026-09-21" como meia-noite em UTC, que no Brasil ainda e dia 20.
function formatarDataPresenca(data) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${data}T12:00:00`));
}

function plural(quantidade, singular, varios) {
  return `${quantidade} ${quantidade === 1 ? singular : varios}`;
}

function itemPresenca(registro) {
  const item = document.createElement('li');
  // textContent em tudo que vem do banco: nome de turma e dado que alguem digitou.
  const aula = document.createElement('div');
  const turma = document.createElement('strong');
  turma.textContent = `${registro.turma_nome} · ${registro.curso_nome}`;
  const quando = document.createElement('p');
  quando.className = 'presenca-data';
  quando.textContent = `${formatarDataPresenca(registro.data)} · ${registro.hora_inicio} às ${registro.hora_fim}`;
  aula.append(turma, quando);
  const situacao = document.createElement('span');
  situacao.className = `agenda-status ${registro.presente ? 'status-presente' : 'status-falta'}`;
  situacao.textContent = registro.presente ? 'Presente' : 'Falta';
  item.append(aula, situacao);
  return item;
}

// A API devolve so as aulas que ja tem chamada, e cada registro e presenca ou
// falta (a coluna e NOT NULL). Por isso faltas = total - presencas, e aula sem
// chamada nao entra na conta. Somar aqui, e nao numa rota nova, porque o
// numero sai da mesma lista que a tela ja mostra. Sem porcentagem: decidido em
// 23/09, o porque esta no GUIA-DA-BANCA.md.
async function carregarMinhasPresencas() {
  try {
    const resposta = await fetch('/api/frequencia/eu', { headers: Sessao.cabecalho() });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      if (resposta.status === 401) window.location.href = 'login.html';
      mostrarMensagemClasses(corpo.message || 'Não foi possível carregar suas presenças.', 'erro');
      return;
    }
    secaoPresencas.hidden = false;
    if (corpo.dados.length === 0) {
      resumoPresencas.textContent = 'Nenhuma chamada registrada ainda. Suas presenças aparecem aqui depois que o professor fizer a chamada da aula.';
      return;
    }
    const presencas = corpo.dados.filter((registro) => registro.presente).length;
    const faltas = corpo.dados.length - presencas;
    resumoPresencas.textContent = `${plural(presencas, 'presença', 'presenças')} e ${plural(faltas, 'falta', 'faltas')}`;
    corpo.dados.forEach((registro) => listaPresencas.appendChild(itemPresenca(registro)));
  } catch (erro) {
    mostrarMensagemClasses('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  }
}

if (alunoConectado()) {
  carregarMinhasClasses();
  carregarMinhasPresencas();
}
