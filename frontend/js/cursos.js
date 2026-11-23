// Tela de cursos (RF03). O catalogo e alterado somente pelo administrador;
// professores consultam os cursos para criar solicitacoes de turma.

const API_URL = '/api/cursos';
const formulario = document.getElementById('formulario-curso');
const cursoId = document.getElementById('curso-id');
const campoNome = document.getElementById('nome');
const campoDescricao = document.getElementById('descricao');
const tituloFormulario = document.getElementById('titulo-formulario');
const botaoCancelar = document.getElementById('botao-cancelar');
const cartaoCurso = document.getElementById('cartao-curso');
const avisoPermissao = document.getElementById('aviso-permissao');
const corpoTabela = document.getElementById('corpo-tabela');
const mensagem = document.getElementById('mensagem');

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = 'mensagem ' + tipo;
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

function celula(texto) {
  const td = document.createElement('td');
  td.textContent = texto || '-';
  return td;
}

function limparFormulario() {
  formulario.reset();
  cursoId.value = '';
  tituloFormulario.textContent = 'Cadastrar curso';
  botaoCancelar.hidden = true;
}

async function carregarCursos() {
  try {
    const resultado = await requisitar(API_URL);
    if (!resultado) return;
    if (!resultado.resposta.ok) return mostrarMensagem(resultado.corpo.message, 'erro');

    corpoTabela.replaceChildren();
    if (resultado.corpo.dados.length === 0) {
      const linha = document.createElement('tr');
      const vazio = celula('Nenhum curso cadastrado ainda.');
      vazio.colSpan = 3;
      linha.appendChild(vazio);
      corpoTabela.appendChild(linha);
      return;
    }

    for (const curso of resultado.corpo.dados) {
      const linha = document.createElement('tr');
      linha.append(celula(curso.nome), celula(curso.descricao));
      const acoes = document.createElement('td');
      if (Sessao.usuario()?.perfil === 'admin') {
        const editar = document.createElement('button');
        editar.textContent = 'Editar';
        editar.className = 'secundario pequeno';
        editar.addEventListener('click', () => prepararEdicao(curso));

        const excluir = document.createElement('button');
        excluir.textContent = 'Excluir';
        excluir.className = 'perigo pequeno';
        excluir.addEventListener('click', () => excluirCurso(curso));
        acoes.append(editar, ' ', excluir);
      } else {
        acoes.textContent = 'Somente consulta';
      }
      linha.appendChild(acoes);
      corpoTabela.appendChild(linha);
    }
  } catch (e) {
    mostrarMensagem('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  }
}

function prepararEdicao(curso) {
  cursoId.value = curso.id;
  campoNome.value = curso.nome;
  campoDescricao.value = curso.descricao || '';
  tituloFormulario.textContent = 'Editar curso';
  botaoCancelar.hidden = false;
  campoNome.focus();
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const editando = cursoId.value !== '';
  try {
    const resultado = await requisitar(editando ? `${API_URL}/${cursoId.value}` : API_URL, {
      method: editando ? 'PUT' : 'POST',
      body: JSON.stringify({ nome: campoNome.value.trim(), descricao: campoDescricao.value.trim() })
    });
    if (!resultado) return;
    if (!resultado.resposta.ok) return mostrarMensagem(resultado.corpo.message, 'erro');
    mostrarMensagem(editando ? 'Curso atualizado.' : 'Curso cadastrado.', 'sucesso');
    limparFormulario();
    carregarCursos();
  } catch (e) {
    mostrarMensagem('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  }
});

botaoCancelar.addEventListener('click', () => {
  limparFormulario();
  mostrarMensagem('', '');
});

async function excluirCurso(curso) {
  if (!confirm(`Excluir o curso ${curso.nome}?`)) return;
  try {
    const resultado = await requisitar(`${API_URL}/${curso.id}`, { method: 'DELETE' });
    if (!resultado) return;
    if (!resultado.resposta.ok) return mostrarMensagem(resultado.corpo.message, 'erro');
    mostrarMensagem('Curso excluído.', 'sucesso');
    carregarCursos();
  } catch (e) {
    mostrarMensagem('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  }
}

const logado = Sessao.usuario();
if (!logado) {
  avisoPermissao.hidden = false;
  avisoPermissao.textContent = 'Entre no sistema para consultar os cursos.';
  cartaoCurso.hidden = true;
} else if (logado.perfil !== 'admin') {
  cartaoCurso.hidden = true;
  avisoPermissao.hidden = false;
  avisoPermissao.textContent = 'Cursos podem ser criados, editados e excluidos somente pelo administrador.';
}

carregarCursos();
