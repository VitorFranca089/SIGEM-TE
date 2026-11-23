// Tela de turmas (RF03). Admin cria/aprova e gerencia; professor solicita e
// acompanha as próprias turmas. A matrícula é administrada dentro da turma.

const API_BASE = '/api';
const formulario = document.getElementById('formulario-turma');
const turmaId = document.getElementById('turma-id');
const cursoSelect = document.getElementById('curso-id');
const professorSelect = document.getElementById('professor-id');
const campoProfessor = document.getElementById('campo-professor');
const campoNome = document.getElementById('nome');
const campoCapa = document.getElementById('capa-url');
const capaArquivo = document.getElementById('capa-arquivo');
const capaEditor = document.getElementById('capa-editor');
const capaPreviewImagem = document.getElementById('capa-preview-imagem');
const capaPosX = document.getElementById('capa-pos-x');
const capaPosY = document.getElementById('capa-pos-y');
const capaZoom = document.getElementById('capa-zoom');
const capaPosXValor = document.getElementById('capa-pos-x-valor');
const capaPosYValor = document.getElementById('capa-pos-y-valor');
const capaZoomValor = document.getElementById('capa-zoom-valor');
const diaSelect = document.getElementById('dia-semana');
const horaInicio = document.getElementById('hora-inicio');
const horaFim = document.getElementById('hora-fim');
const statusSelect = document.getElementById('status');
const campoStatus = document.getElementById('campo-status');
const tituloFormulario = document.getElementById('titulo-formulario');
const ajudaFormulario = document.getElementById('ajuda-formulario');
const botaoCancelar = document.getElementById('botao-cancelar');
const cartaoTurma = document.getElementById('cartao-turma');
const avisoPermissao = document.getElementById('aviso-permissao');
const corpoTabela = document.getElementById('corpo-tabela');
const mensagem = document.getElementById('mensagem');
const cartaoAlunos = document.getElementById('cartao-alunos');
const tituloAlunos = document.getElementById('titulo-alunos');
const alunoSelect = document.getElementById('aluno-matricula');
const campoMatricula = document.getElementById('campo-matricula');
const listaAlunos = document.getElementById('lista-alunos');
const mensagemAlunos = document.getElementById('mensagem-alunos');
const botaoAdicionarAluno = document.getElementById('botao-adicionar-aluno');

const usuarioLogado = Sessao.usuario();
let cursos = [];
let professores = [];
let alunos = [];
let turmaSelecionada = null;
let editandoApenasCapa = false;
let capaObjetoUrl = '';

const nomesDias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const nomesStatus = {
  solicitada: 'Solicitada',
  ativa: 'Ativa',
  recusada: 'Recusada',
  encerrada: 'Encerrada'
};

function mostrarMensagem(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = 'mensagem ' + tipo;
}

async function requisitar(url, opcoes = {}) {
  const ehFormulario = opcoes.body instanceof FormData;
  const headers = { ...Sessao.cabecalho(), ...(opcoes.body && !ehFormulario ? { 'Content-Type': 'application/json' } : {}) };
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

function preencherReferencias() {
  cursoSelect.replaceChildren(opcao('', 'Selecione um curso'));
  cursos.forEach((curso) => cursoSelect.appendChild(opcao(curso.id, curso.nome)));

  professorSelect.replaceChildren(opcao('', 'Selecione um professor'));
  professores.forEach((professor) => professorSelect.appendChild(opcao(professor.id, professor.nome)));

  diaSelect.replaceChildren(opcao('', 'Selecione um dia'));
  nomesDias.forEach((dia, indice) => diaSelect.appendChild(opcao(indice, dia)));
}

function limparFormulario() {
  formulario.reset();
  if (capaObjetoUrl) URL.revokeObjectURL(capaObjetoUrl);
  capaObjetoUrl = '';
  capaEditor.hidden = true;
  editandoApenasCapa = false;
  [cursoSelect, professorSelect, campoNome, diaSelect, horaInicio, horaFim, statusSelect].forEach((campo) => {
    campo.disabled = false;
  });
  turmaId.value = '';
  statusSelect.value = usuarioLogado?.perfil === 'admin' ? 'ativa' : 'solicitada';
  tituloFormulario.textContent = usuarioLogado?.perfil === 'admin' ? 'Cadastrar turma' : 'Solicitar nova turma';
  ajudaFormulario.textContent = usuarioLogado?.perfil === 'admin'
    ? 'Turmas criadas pelo administrador entram ativas imediatamente.'
    : 'A solicitação será analisada e aprovada pelo administrador.';
  botaoCancelar.hidden = true;
}

function atualizarValoresDaCapa() {
  capaPosXValor.value = `${capaPosX.value}%`;
  capaPosYValor.value = `${capaPosY.value}%`;
  capaZoomValor.value = `${Number(capaZoom.value).toFixed(2).replace('.', ',')}×`;
  capaPreviewImagem.style.objectPosition = `${capaPosX.value}% ${capaPosY.value}%`;
  capaPreviewImagem.style.transform = `scale(${capaZoom.value})`;
}

function atualizarPreviaDaCapa() {
  const fonte = capaObjetoUrl || campoCapa.value.trim();
  capaEditor.hidden = !fonte;
  if (fonte) {
    capaPreviewImagem.src = fonte;
    atualizarValoresDaCapa();
  } else {
    capaPreviewImagem.removeAttribute('src');
  }
}

function definirAjustesDaCapa(turma = {}) {
  capaPosX.value = turma.capa_pos_x ?? 50;
  capaPosY.value = turma.capa_pos_y ?? 50;
  capaZoom.value = turma.capa_zoom ?? 1;
  atualizarValoresDaCapa();
}

function celula(texto) {
  const td = document.createElement('td');
  td.textContent = texto || '-';
  return td;
}

function formatarHorario(turma) {
  if (turma.dia_semana == null || !turma.hora_inicio || !turma.hora_fim) return 'Não definido';
  return `${nomesDias[turma.dia_semana]} ${turma.hora_inicio} - ${turma.hora_fim}`;
}

function botao(texto, classe, acao) {
  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = texto;
  item.className = `${classe} pequeno`;
  item.addEventListener('click', acao);
  return item;
}

function renderizarTurmas(turmas) {
  corpoTabela.replaceChildren();
  if (turmas.length === 0) {
    const linha = document.createElement('tr');
    const vazio = celula('Nenhuma turma encontrada.');
    vazio.colSpan = 7;
    linha.appendChild(vazio);
    corpoTabela.appendChild(linha);
    return;
  }

  for (const turma of turmas) {
    const linha = document.createElement('tr');
    linha.append(
      celula(turma.nome),
      celula(turma.curso_nome),
      celula(turma.professor_nome),
      celula(formatarHorario(turma)),
      celula(nomesStatus[turma.status] || turma.status),
      celula(turma.alunos_count)
    );

    const acoes = document.createElement('td');
    const podeEditar = usuarioLogado?.perfil === 'admin' || turma.status === 'solicitada';
    if (podeEditar) acoes.appendChild(botao('Editar', 'secundario', () => prepararEdicao(turma)));
    if (usuarioLogado?.perfil === 'admin' || usuarioLogado?.perfil === 'professor') {
      if (acoes.childNodes.length > 0) acoes.append(' ');
      acoes.appendChild(botao('Capa', 'secundario', () => prepararEdicaoCapa(turma)));
    }
    if (turma.status === 'ativa') {
      if (acoes.childNodes.length > 0) acoes.append(' ');
      acoes.appendChild(botao('Alunos', 'secundario', () => abrirAlunos(turma)));
    }
    if (usuarioLogado?.perfil === 'admin') {
      if (acoes.childNodes.length > 0) acoes.append(' ');
      acoes.appendChild(botao('Encerrar', 'perigo', () => excluirTurma(turma)));
    }
    linha.appendChild(acoes);
    corpoTabela.appendChild(linha);
  }
}

async function carregarTurmas() {
  const resultado = await requisitar(`${API_BASE}/turmas`);
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagem, resultado.corpo.message, 'erro');
  renderizarTurmas(resultado.corpo.dados);
}

async function carregarReferencias() {
  const respostas = await Promise.all([
    requisitar(`${API_BASE}/cursos`),
    requisitar(`${API_BASE}/professores`),
    requisitar(`${API_BASE}/alunos`)
  ]);
  if (respostas.some((resultado) => !resultado)) return;
  const falha = respostas.find((resultado) => !resultado.resposta.ok);
  if (falha) return mostrarMensagem(mensagem, falha.corpo.message, 'erro');
  cursos = respostas[0].corpo.dados;
  professores = respostas[1].corpo.dados;
  alunos = respostas[2].corpo.dados;
  preencherReferencias();
}

function prepararEdicao(turma) {
  editandoApenasCapa = false;
  [cursoSelect, professorSelect, campoNome, diaSelect, horaInicio, horaFim, statusSelect].forEach((campo) => {
    campo.disabled = false;
  });
  turmaId.value = turma.id;
  cursoSelect.value = turma.curso_id;
  professorSelect.value = turma.professor_id;
  campoNome.value = turma.nome;
  diaSelect.value = turma.dia_semana;
  horaInicio.value = turma.hora_inicio;
  horaFim.value = turma.hora_fim;
  campoCapa.value = turma.capa_url || '';
  capaArquivo.value = '';
  if (capaObjetoUrl) URL.revokeObjectURL(capaObjetoUrl);
  capaObjetoUrl = '';
  definirAjustesDaCapa(turma);
  atualizarPreviaDaCapa();
  statusSelect.value = turma.status;
  tituloFormulario.textContent = usuarioLogado?.perfil === 'admin' ? 'Editar turma' : 'Editar solicitação';
  ajudaFormulario.textContent = usuarioLogado?.perfil === 'admin'
    ? 'A edição pode aprovar, recusar, renomear ou trocar professor e horário.'
    : 'Enquanto estiver pendente, você pode ajustar a solicitação.';
  botaoCancelar.hidden = false;
  campoNome.focus();
}

function prepararEdicaoCapa(turma) {
  prepararEdicao(turma);
  editandoApenasCapa = true;
  [cursoSelect, professorSelect, campoNome, diaSelect, horaInicio, horaFim, statusSelect].forEach((campo) => {
    campo.disabled = true;
  });
  tituloFormulario.textContent = 'Editar capa da turma';
  ajudaFormulario.textContent = 'O administrador ou o professor responsável pode trocar esta imagem.';
  campoCapa.focus();
}

async function enviarArquivoCapa(id) {
  if (!capaArquivo.files.length) return null;
  const dados = new FormData();
  dados.append('imagem', capaArquivo.files[0]);
  dados.append('capa_pos_x', capaPosX.value);
  dados.append('capa_pos_y', capaPosY.value);
  dados.append('capa_zoom', capaZoom.value);
  return requisitar(`${API_BASE}/turmas/${id}/capa/arquivo`, {
    method: 'POST',
    body: dados
  });
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const editando = turmaId.value !== '';
  if (editandoApenasCapa) {
    try {
      const resultado = capaArquivo.files.length
        ? await enviarArquivoCapa(turmaId.value)
        : await requisitar(`${API_BASE}/turmas/${turmaId.value}/capa`, {
          method: 'PATCH',
          body: JSON.stringify({
            capa_url: campoCapa.value.trim(),
            capa_pos_x: Number(capaPosX.value),
            capa_pos_y: Number(capaPosY.value),
            capa_zoom: Number(capaZoom.value)
          })
        });
      if (!resultado) return;
      if (!resultado.resposta.ok) return mostrarMensagem(mensagem, resultado.corpo.message, 'erro');
      mostrarMensagem(mensagem, 'Capa atualizada.', 'sucesso');
      limparFormulario();
      await carregarTurmas();
    } catch (e) {
      mostrarMensagem(mensagem, 'Não foi possível atualizar a capa.', 'erro');
    }
    return;
  }
  const dados = {
    curso_id: Number(cursoSelect.value),
    nome: campoNome.value.trim(),
    dia_semana: Number(diaSelect.value),
    hora_inicio: horaInicio.value,
    hora_fim: horaFim.value,
    capa_url: capaArquivo.files.length ? '' : campoCapa.value.trim(),
    capa_pos_x: Number(capaPosX.value),
    capa_pos_y: Number(capaPosY.value),
    capa_zoom: Number(capaZoom.value)
  };
  if (usuarioLogado?.perfil === 'admin') {
    dados.professor_id = Number(professorSelect.value);
    dados.status = statusSelect.value;
  }

  try {
    const resultado = await requisitar(editando ? `${API_BASE}/turmas/${turmaId.value}` : `${API_BASE}/turmas`, {
      method: editando ? 'PUT' : 'POST',
      body: JSON.stringify(dados)
    });
    if (!resultado) return;
    if (!resultado.resposta.ok) return mostrarMensagem(mensagem, resultado.corpo.message, 'erro');
    if (capaArquivo.files.length) {
      const resultadoCapa = await enviarArquivoCapa(resultado.corpo.dados.id || turmaId.value);
      if (!resultadoCapa) return;
      if (!resultadoCapa.resposta.ok) return mostrarMensagem(mensagem, resultadoCapa.corpo.message, 'erro');
    }
    mostrarMensagem(mensagem, editando ? 'Turma atualizada.' : 'Turma solicitada/criada.', 'sucesso');
    limparFormulario();
    await carregarTurmas();
  } catch (e) {
    mostrarMensagem(mensagem, 'Não foi possível falar com o backend. Ele está rodando?', 'erro');
  }
});

botaoCancelar.addEventListener('click', () => {
  limparFormulario();
  mostrarMensagem(mensagem, '', '');
});

campoCapa.addEventListener('input', () => {
  if (capaArquivo.files.length) return;
  atualizarPreviaDaCapa();
});

capaArquivo.addEventListener('change', () => {
  if (capaObjetoUrl) URL.revokeObjectURL(capaObjetoUrl);
  capaObjetoUrl = capaArquivo.files[0] ? URL.createObjectURL(capaArquivo.files[0]) : '';
  atualizarPreviaDaCapa();
});

[capaPosX, capaPosY, capaZoom].forEach((controle) => {
  controle.addEventListener('input', atualizarValoresDaCapa);
});

async function excluirTurma(turma) {
  if (!confirm(`Encerrar a turma ${turma.nome}? O histórico será preservado.`)) return;
  const resultado = await requisitar(`${API_BASE}/turmas/${turma.id}`, { method: 'DELETE' });
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagem, resultado.corpo.message, 'erro');
  mostrarMensagem(mensagem, 'Turma encerrada.', 'sucesso');
  if (turmaSelecionada?.id === turma.id) cartaoAlunos.hidden = true;
  carregarTurmas();
}

function renderizarListaAlunos(matriculados) {
  listaAlunos.replaceChildren();
  // So o admin matricula (a API recusa o professor); para o professor a lista
  // e so leitura.
  const podeMatricular = usuarioLogado?.perfil === 'admin';
  campoMatricula.hidden = !podeMatricular;
  const ids = new Set(matriculados.map((aluno) => aluno.id));
  alunoSelect.replaceChildren(opcao('', 'Selecione um aluno'));
  alunos.filter((aluno) => !ids.has(aluno.id)).forEach((aluno) => {
    alunoSelect.appendChild(opcao(aluno.id, `${aluno.nome} — ${aluno.email}`));
  });

  if (matriculados.length === 0) {
    const vazio = document.createElement('li');
    vazio.textContent = 'Nenhum aluno matriculado.';
    listaAlunos.appendChild(vazio);
    return;
  }
  matriculados.forEach((aluno) => {
    const item = document.createElement('li');
    item.textContent = `${aluno.nome} — ${aluno.email}`;
    if (podeMatricular) item.appendChild(botao('Remover', 'perigo', () => removerAluno(aluno)));
    listaAlunos.appendChild(item);
  });
}

async function abrirAlunos(turma) {
  turmaSelecionada = turma;
  cartaoAlunos.hidden = false;
  tituloAlunos.textContent = `Alunos da turma ${turma.nome}`;
  mostrarMensagem(mensagemAlunos, 'Carregando...', '');
  const resultado = await requisitar(`${API_BASE}/turmas/${turma.id}/alunos`);
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagemAlunos, resultado.corpo.message, 'erro');
  renderizarListaAlunos(resultado.corpo.dados);
  mostrarMensagem(mensagemAlunos, '', '');
}

botaoAdicionarAluno.addEventListener('click', async () => {
  if (!turmaSelecionada || !alunoSelect.value) {
    return mostrarMensagem(mensagemAlunos, 'Selecione um aluno.', 'erro');
  }
  const resultado = await requisitar(`${API_BASE}/turmas/${turmaSelecionada.id}/alunos`, {
    method: 'POST',
    body: JSON.stringify({ aluno_id: Number(alunoSelect.value) })
  });
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagemAlunos, resultado.corpo.message, 'erro');
  abrirAlunos(turmaSelecionada);
  carregarTurmas();
});

async function removerAluno(aluno) {
  if (!turmaSelecionada || !confirm(`Remover ${aluno.nome} da turma?`)) return;
  const resultado = await requisitar(`${API_BASE}/turmas/${turmaSelecionada.id}/alunos/${aluno.id}`, { method: 'DELETE' });
  if (!resultado) return;
  if (!resultado.resposta.ok) return mostrarMensagem(mensagemAlunos, resultado.corpo.message, 'erro');
  abrirAlunos(turmaSelecionada);
  carregarTurmas();
}

if (!usuarioLogado) {
  avisoPermissao.hidden = false;
  avisoPermissao.textContent = 'Entre no sistema para acessar turmas.';
  cartaoTurma.hidden = true;
} else if (usuarioLogado.perfil !== 'admin') {
  campoProfessor.hidden = true;
  professorSelect.required = false;
  campoStatus.hidden = true;
  ajudaFormulario.textContent = 'A solicitação será analisada e aprovada pelo administrador.';
}

limparFormulario();
if (usuarioLogado) {
  carregarReferencias().then(carregarTurmas).catch(() => {
    mostrarMensagem(mensagem, 'Não foi possível carregar os dados do RF03.', 'erro');
  });
}
