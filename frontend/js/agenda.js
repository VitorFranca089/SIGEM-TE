// Agenda do RF04. A tela serve aos tres perfis, mas apenas admin e professor
// recebem os controles de escrita. O backend continua sendo a autoridade.

const usuarioLogado = Sessao.usuario();
const API_BASE = '/api';
const formulario = document.getElementById('formulario-aula');
const formularioGrupo = document.getElementById('formulario-grupo');
const cartaoFormulario = document.getElementById('cartao-formulario');
const cartaoGrupo = document.getElementById('cartao-grupo');
const painelMembros = document.getElementById('painel-membros');
const tipoAula = document.getElementById('tipo-aula');
const turmaSelect = document.getElementById('turma-id');
const grupoSelect = document.getElementById('grupo-id');
const campoTurma = document.getElementById('campo-turma');
const campoGrupo = document.getElementById('campo-grupo');
const aulaId = document.getElementById('aula-id');
const campoData = document.getElementById('data');
const campoInicio = document.getElementById('hora-inicio');
const campoFim = document.getElementById('hora-fim');
const campoObservacoes = document.getElementById('observacoes');
const listaAgenda = document.getElementById('lista-agenda');
const mensagemAgenda = document.getElementById('mensagem-agenda');
const mensagemFormulario = document.getElementById('mensagem-formulario');
const avisoPermissao = document.getElementById('aviso-permissao');
const filtroInicio = document.getElementById('filtro-inicio');
const filtroFim = document.getElementById('filtro-fim');
const alunoGrupoSelect = document.getElementById('aluno-grupo');
const listaMembros = document.getElementById('lista-membros');
const mensagemGrupo = document.getElementById('mensagem-grupo');

let turmas = [];
let grupos = [];
let alunos = [];
let grupoSelecionado = null;

function dataLocal(offsetDias = 0) {
  const data = new Date();
  data.setDate(data.getDate() + offsetDias);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function mostrarMensagem(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = 'mensagem ' + tipo;
}

async function requisitar(url, opcoes = {}) {
  const headers = { ...Sessao.cabecalho(), ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}) };
  const resposta = await fetch(url, { ...opcoes, headers });
  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.status === 401) {
    Sessao.encerrar();
    window.location.href = 'login.html';
    return null;
  }
  return { resposta, corpo };
}

function opcao(valor, texto) {
  const item = document.createElement('option');
  item.value = valor;
  item.textContent = texto;
  return item;
}

function preencherSelects() {
  turmaSelect.replaceChildren(opcao('', 'Selecione uma turma'));
  turmas.forEach((turma) => turmaSelect.appendChild(opcao(turma.id, `${turma.nome} — ${turma.curso_nome}`)));
  grupoSelect.replaceChildren(opcao('', 'Selecione um grupo'));
  grupos.forEach((grupo) => grupoSelect.appendChild(opcao(grupo.id, `${grupo.nome} (${grupo.alunos_count} aluno(s))`)));
  alunoGrupoSelect.replaceChildren(opcao('', 'Selecione um aluno'));
  alunos.forEach((aluno) => alunoGrupoSelect.appendChild(opcao(aluno.id, `${aluno.nome} — ${aluno.email}`)));
}

function atualizarTipo() {
  const grupo = tipoAula.value === 'grupo';
  campoTurma.hidden = grupo;
  campoGrupo.hidden = !grupo;
  turmaSelect.required = !grupo;
  grupoSelect.required = grupo;
  document.getElementById('ajuda-horario').textContent = grupo
    ? 'Encontros de grupo são flexíveis e não precisam seguir o horário semanal de uma turma.'
    : 'A turma preenche o horário semanal automaticamente. Você pode ajustá-lo para uma reposição.';
  if (!grupo && turmaSelect.value) preencherHorarioTurma();
}

function preencherHorarioTurma() {
  const turma = turmas.find((item) => String(item.id) === turmaSelect.value);
  if (!turma) return;
  campoInicio.value = turma.hora_inicio || '';
  campoFim.value = turma.hora_fim || '';
}

function limparFormulario() {
  formulario.reset();
  aulaId.value = '';
  campoData.value = dataLocal(1);
  document.getElementById('titulo-formulario').textContent = 'Agendar aula';
  document.getElementById('botao-salvar').textContent = 'Agendar aula';
  document.getElementById('botao-cancelar-edicao').hidden = true;
  atualizarTipo();
  mostrarMensagem(mensagemFormulario, '', '');
}

function editarAula(aula) {
  aulaId.value = aula.id;
  tipoAula.value = aula.grupo_id ? 'grupo' : 'turma';
  atualizarTipo();
  turmaSelect.value = aula.turma_id || '';
  grupoSelect.value = aula.grupo_id || '';
  campoData.value = aula.data;
  campoInicio.value = aula.hora_inicio;
  campoFim.value = aula.hora_fim;
  campoObservacoes.value = aula.observacoes || '';
  document.getElementById('titulo-formulario').textContent = 'Editar aula';
  document.getElementById('botao-salvar').textContent = 'Salvar alterações';
  document.getElementById('botao-cancelar-edicao').hidden = false;
  cartaoFormulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatarData(data) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date(`${data}T12:00:00`));
}

function criarBotao(texto, classe, acao) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = `${classe} pequeno`;
  botao.textContent = texto;
  botao.addEventListener('click', acao);
  return botao;
}

function renderizarAgenda(aulas) {
  listaAgenda.replaceChildren();
  if (aulas.length === 0) {
    const vazio = document.createElement('section');
    vazio.className = 'cartao empty-state';
    vazio.innerHTML = '<span>◷</span><h3>Nenhuma aula nesse período</h3><p>Altere o intervalo ou agende um novo compromisso.</p>';
    listaAgenda.appendChild(vazio);
    return;
  }
  aulas.forEach((aula) => {
    const cartao = document.createElement('article');
    cartao.className = `cartao agenda-card ${aula.status === 'cancelada' ? 'agenda-cancelada' : ''}`;
    const tipo = document.createElement('p');
    tipo.className = 'overline';
    tipo.textContent = aula.grupo_id ? 'Grupo extracurricular' : aula.curso_nome || 'Turma';
    const titulo = document.createElement('h3');
    titulo.textContent = aula.grupo_nome || aula.turma_nome || 'Aula';
    const data = document.createElement('p');
    data.className = 'agenda-data';
    data.textContent = `${formatarData(aula.data)} · ${aula.hora_inicio} às ${aula.hora_fim}`;
    const responsavel = document.createElement('p');
    responsavel.textContent = aula.responsavel_nome ? `Responsável: ${aula.responsavel_nome}` : 'Responsável a definir';
    const status = document.createElement('span');
    status.className = `agenda-status status-${aula.status}`;
    status.textContent = aula.status === 'cancelada' ? 'Cancelada' : aula.status === 'realizada' ? 'Realizada' : 'Agendada';
    cartao.append(tipo, titulo, data, responsavel, status);
    if (aula.observacoes) {
      const observacoes = document.createElement('p');
      observacoes.className = 'ajuda';
      observacoes.textContent = aula.observacoes;
      cartao.appendChild(observacoes);
    }
    if (usuarioLogado && ['admin', 'professor'].includes(usuarioLogado.perfil) && aula.status === 'agendada') {
      const acoes = document.createElement('div');
      acoes.className = 'agenda-acoes';
      acoes.appendChild(criarBotao('Editar', 'secundario', () => editarAula(aula)));
      acoes.appendChild(criarBotao('Cancelar aula', 'perigo', () => cancelarAula(aula)));
      cartao.appendChild(acoes);
    }
    if (aula.status === 'cancelada' && aula.motivo_cancelamento) {
      const motivo = document.createElement('small');
      motivo.className = 'ajuda';
      motivo.textContent = `Motivo: ${aula.motivo_cancelamento}`;
      cartao.appendChild(motivo);
    }
    listaAgenda.appendChild(cartao);
  });
}

async function carregarAgenda() {
  const params = new URLSearchParams({ inicio: filtroInicio.value });
  if (filtroFim.value) params.set('fim', filtroFim.value);
  try {
    const resultado = await requisitar(`${API_BASE}/aulas?${params}`);
    if (!resultado) return;
    if (!resultado.resposta.ok) return mostrarMensagem(mensagemAgenda, resultado.corpo.message, 'erro');
    renderizarAgenda(resultado.corpo.dados);
    mostrarMensagem(mensagemAgenda, '', '');
  } catch (e) {
    mostrarMensagem(mensagemAgenda, 'Não foi possível carregar a agenda.', 'erro');
  }
}

async function carregarReferencias() {
  const respostas = await Promise.all([
    requisitar(`${API_BASE}/turmas`),
    requisitar(`${API_BASE}/grupos`),
    requisitar(`${API_BASE}/alunos`)
  ]);
  if (respostas.some((resultado) => !resultado)) return;
  const falha = respostas.find((resultado) => !resultado.resposta.ok);
  if (falha) return mostrarMensagem(mensagemFormulario, falha.corpo.message, 'erro');
  turmas = respostas[0].corpo.dados.filter((turma) => turma.status === 'ativa');
  grupos = respostas[1].corpo.dados;
  alunos = respostas[2].corpo.dados;
  preencherSelects();
}

async function cancelarAula(aula) {
  const motivo = window.prompt('Informe o motivo do cancelamento (opcional):');
  if (motivo === null) return;
  const resultado = await requisitar(`${API_BASE}/aulas/${aula.id}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo: motivo.trim() })
  });
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagemAgenda, resultado.corpo.message, 'erro');
  const avisos = resultado.corpo.avisos || {};
  mostrarMensagem(mensagemAgenda, `Aula cancelada. Avisos enviados: ${avisos.enviados || 0}.`, avisos.falharam ? 'erro' : 'sucesso');
  await carregarAgenda();
}

async function carregarMembros(grupoId) {
  if (!grupoId) {
    painelMembros.hidden = true;
    grupoSelecionado = null;
    return;
  }
  const resultado = await requisitar(`${API_BASE}/grupos/${grupoId}/membros`);
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagemGrupo, resultado.corpo.message, 'erro');
  grupoSelecionado = Number(grupoId);
  painelMembros.hidden = false;
  const membros = resultado.corpo.dados;
  const ids = new Set(membros.map((aluno) => aluno.id));
  alunoGrupoSelect.replaceChildren(opcao('', 'Selecione um aluno'));
  alunos.filter((aluno) => !ids.has(aluno.id)).forEach((aluno) => {
    alunoGrupoSelect.appendChild(opcao(aluno.id, `${aluno.nome} — ${aluno.email}`));
  });
  listaMembros.replaceChildren();
  if (membros.length === 0) {
    const vazio = document.createElement('li');
    vazio.textContent = 'Nenhum aluno participa deste grupo.';
    listaMembros.appendChild(vazio);
  } else {
    membros.forEach((aluno) => {
      const item = document.createElement('li');
      item.textContent = `${aluno.nome} — ${aluno.email}`;
      item.appendChild(criarBotao('Remover', 'perigo', () => removerMembro(aluno)));
      listaMembros.appendChild(item);
    });
  }
}

async function removerMembro(aluno) {
  const resultado = await requisitar(`${API_BASE}/grupos/${grupoSelecionado}/membros/${aluno.id}`, { method: 'DELETE' });
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagemGrupo, resultado.corpo.message, 'erro');
  carregarMembros(grupoSelecionado);
}

tipoAula.addEventListener('change', atualizarTipo);
turmaSelect.addEventListener('change', preencherHorarioTurma);
grupoSelect.addEventListener('change', () => carregarMembros(grupoSelect.value));
document.getElementById('botao-filtrar').addEventListener('click', carregarAgenda);
document.getElementById('botao-cancelar-edicao').addEventListener('click', limparFormulario);

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const editando = Boolean(aulaId.value);
  const dados = {
    data: campoData.value,
    hora_inicio: campoInicio.value,
    hora_fim: campoFim.value,
    observacoes: campoObservacoes.value.trim()
  };
  if (!editando) {
    if (tipoAula.value === 'grupo') dados.grupo_id = Number(grupoSelect.value);
    else dados.turma_id = Number(turmaSelect.value);
  }
  try {
    const resultado = await requisitar(editando ? `${API_BASE}/aulas/${aulaId.value}` : `${API_BASE}/aulas`, {
      method: editando ? 'PUT' : 'POST',
      body: JSON.stringify(dados)
    });
    if (!resultado) return;
    if (!resultado.resposta.ok) return mostrarMensagem(mensagemFormulario, resultado.corpo.message, 'erro');
    mostrarMensagem(mensagemFormulario, editando ? 'Aula atualizada.' : 'Aula agendada.', 'sucesso');
    limparFormulario();
    await carregarAgenda();
  } catch (e) {
    mostrarMensagem(mensagemFormulario, 'Não foi possível falar com o backend.', 'erro');
  }
});

formularioGrupo.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const resultado = await requisitar(`${API_BASE}/grupos`, {
    method: 'POST',
    body: JSON.stringify({
      nome: document.getElementById('grupo-nome').value.trim(),
      descricao: document.getElementById('grupo-descricao').value.trim()
    })
  });
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagemGrupo, resultado.corpo.message, 'erro');
  formularioGrupo.reset();
  mostrarMensagem(mensagemGrupo, 'Grupo criado. Agora você pode selecioná-lo na agenda.', 'sucesso');
  await carregarReferencias();
  grupoSelect.value = resultado.corpo.dados.id;
  tipoAula.value = 'grupo';
  atualizarTipo();
  carregarMembros(grupoSelect.value);
});

filtroInicio.value = dataLocal();
filtroFim.value = dataLocal(30);

if (!usuarioLogado) {
  avisoPermissao.hidden = false;
  avisoPermissao.textContent = 'Entre no sistema para consultar a agenda.';
} else if (['admin', 'professor'].includes(usuarioLogado.perfil)) {
  cartaoFormulario.hidden = false;
  cartaoGrupo.hidden = false;
  carregarReferencias().catch(() => mostrarMensagem(mensagemFormulario, 'Não foi possível carregar as referências.', 'erro'));
} else {
  avisoPermissao.hidden = false;
  avisoPermissao.textContent = 'Os seus compromissos aparecem abaixo. Grupos extracurriculares são opcionais.';
}

limparFormulario();
if (usuarioLogado) carregarAgenda();
