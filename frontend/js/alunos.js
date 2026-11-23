// Tela de alunos (RF01). Sem framework, conforme o RNF02.

// Endereco relativo: a CSP do servidor so deixa a tela chamar o proprio
// endereco dela, e com 'http://localhost:3000' escrito por extenso quem abrisse
// o sistema por 127.0.0.1:3000 ficava sem conseguir falar com a API.
const API_URL = '/api/alunos';

const formulario = document.getElementById('formulario-aluno');
const campoId = document.getElementById('aluno-id');
const campoNome = document.getElementById('nome');
const campoEmail = document.getElementById('email');
const campoSenha = document.getElementById('senha');
const campoConfirmacaoSenha = document.getElementById('confirmacao-senha');
const campoNascimento = document.getElementById('data-nascimento');
const blocoSenha = document.getElementById('campo-senha');
const blocoConfirmacaoSenha = document.getElementById('campo-confirmacao-senha');
const tituloFormulario = document.getElementById('titulo-formulario');
const botaoCancelar = document.getElementById('botao-cancelar');
const corpoTabela = document.getElementById('corpo-tabela');
const botaoVerSenha = document.getElementById('botao-ver-senha');
const forcaSenha = document.getElementById('forca-senha');
const mensagem = document.getElementById('mensagem');
const podeAdministrarAlunos = Sessao.usuario()?.perfil === 'admin';

if (!podeAdministrarAlunos) {
  formulario.closest('.cartao').hidden = true;
}

// A data de nascimento nao pode ser no futuro nem absurdamente antiga. Os
// limites sao calculados a partir de hoje, entao ficam aqui e nao no HTML.
// Isto e conforto para quem digita: quem valida de verdade e o backend.
(function definirLimitesDeData() {
  const hoje = new Date();
  const maisAntiga = new Date();
  maisAntiga.setFullYear(hoje.getFullYear() - 120);
  const dataLocal = (data) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };
  campoNascimento.max = dataLocal(hoje);
  campoNascimento.min = dataLocal(maisAntiga);
})();

// Mostrar/ocultar a senha. Trocar o type do input entre "password" e "text" e
// tudo que e preciso - o valor digitado nao se perde na troca.
botaoVerSenha.addEventListener('click', () => {
  const escondida = campoSenha.type === 'password';
  campoSenha.type = escondida ? 'text' : 'password';
  botaoVerSenha.textContent = escondida ? 'Ocultar' : 'Mostrar';
});

// Indicador simples de forca: conta o tamanho e quantos tipos de caractere
// diferentes aparecem. Nao e uma medida de seguranca, e uma dica visual - quem
// recusa senha curta de verdade e a validacao do servidor.
function avaliarSenha(senha) {
  if (senha.length === 0) return { texto: 'Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial.', classe: '' };
  const faltantes = [];
  if (senha.length < 8) faltantes.push('8 caracteres');
  if (!/[A-Z]/.test(senha)) faltantes.push('uma maiúscula');
  if (!/[a-z]/.test(senha)) faltantes.push('uma minúscula');
  if (!/[0-9]/.test(senha)) faltantes.push('um número');
  if (!/[^A-Za-z0-9]/.test(senha)) faltantes.push('um caractere especial');
  return faltantes.length === 0
    ? { texto: 'Senha forte.', classe: 'forte' }
    : { texto: 'Falta: ' + faltantes.join(', ') + '.', classe: 'fraca' };
}

campoSenha.addEventListener('input', () => {
  const avaliacao = avaliarSenha(campoSenha.value);
  forcaSenha.textContent = avaliacao.texto;
  forcaSenha.className = 'ajuda ' + avaliacao.classe;
});

campoConfirmacaoSenha.addEventListener('input', () => {
  campoConfirmacaoSenha.setCustomValidity(
    campoSenha.value === campoConfirmacaoSenha.value ? '' : 'As senhas não coincidem'
  );
});

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = 'mensagem ' + tipo;
}

// Monta uma celula com texto. Usar textContent em vez de innerHTML e proposital:
// se o nome do aluno contiver "<script>", o innerHTML executaria o codigo.
function celula(texto) {
  const td = document.createElement('td');
  td.textContent = texto || '-';
  return td;
}

function formatarData(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function carregarAlunos() {
  try {
    const resposta = await fetch(API_URL, { headers: Sessao.cabecalho() });
    const corpo = await resposta.json();

    if (resposta.status === 401) {
      Sessao.encerrar();
      window.location.href = 'login.html';
      return;
    }

    if (corpo.status !== 'ok') {
      return mostrarMensagem(corpo.message, 'erro');
    }

    corpoTabela.replaceChildren();

    if (corpo.dados.length === 0) {
      const linha = document.createElement('tr');
      const td = celula('Nenhum aluno cadastrado ainda.');
      td.colSpan = 4;
      linha.appendChild(td);
      corpoTabela.appendChild(linha);
      return;
    }

    for (const aluno of corpo.dados) {
      const linha = document.createElement('tr');
      linha.appendChild(celula(aluno.nome));
      linha.appendChild(celula(aluno.email));
      linha.appendChild(celula(formatarData(aluno.data_nascimento)));

      const acoes = document.createElement('td');

      if (podeAdministrarAlunos) {
        const editar = document.createElement('button');
        editar.textContent = 'Editar';
        editar.className = 'secundario';
        editar.addEventListener('click', () => prepararEdicao(aluno));

        const excluir = document.createElement('button');
        excluir.textContent = 'Excluir';
        excluir.className = 'perigo';
        excluir.addEventListener('click', () => excluirAluno(aluno));
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

function prepararEdicao(aluno) {
  campoId.value = aluno.id;
  campoNome.value = aluno.nome;
  campoEmail.value = aluno.email;
  campoNascimento.value = aluno.data_nascimento || '';

  // Sem senha na edicao: o campo sai da tela e perde o "required", senao o
  // navegador bloqueia o envio de um campo obrigatorio que esta escondido.
  blocoSenha.hidden = true;
  blocoConfirmacaoSenha.hidden = true;
  campoSenha.required = false;
  campoConfirmacaoSenha.required = false;
  // volta a esconder o texto, caso o usuario tenha deixado "Mostrar" ligado
  campoSenha.type = 'password';
  botaoVerSenha.textContent = 'Mostrar';

  tituloFormulario.textContent = 'Editar aluno';
  botaoCancelar.hidden = false;
  mostrarMensagem('', '');
  campoNome.focus();
}

function limparFormulario() {
  formulario.reset();
  campoId.value = '';
  blocoSenha.hidden = false;
  blocoConfirmacaoSenha.hidden = false;
  campoSenha.required = true;
  campoConfirmacaoSenha.required = true;
  campoConfirmacaoSenha.setCustomValidity('');
  campoSenha.type = 'password';
  botaoVerSenha.textContent = 'Mostrar';
  forcaSenha.textContent = 'Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial.';
  forcaSenha.className = 'ajuda';
  tituloFormulario.textContent = 'Cadastrar aluno';
  botaoCancelar.hidden = true;
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const editando = campoId.value !== '';
  const dados = {
    nome: campoNome.value.trim(),
    email: campoEmail.value.trim(),
    data_nascimento: campoNascimento.value || null
  };
  if (!editando) {
    dados.senha = campoSenha.value;
    dados.senha_confirmacao = campoConfirmacaoSenha.value;
  }

  try {
    const resposta = await fetch(editando ? `${API_URL}/${campoId.value}` : API_URL, {
      method: editando ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', ...Sessao.cabecalho() },
      body: JSON.stringify(dados)
    });
    const corpo = await resposta.json();

    if (corpo.status !== 'ok') {
      return mostrarMensagem(corpo.message, 'erro');
    }

    mostrarMensagem(editando ? 'Aluno atualizado.' : 'Aluno cadastrado.', 'sucesso');
    limparFormulario();
    carregarAlunos();
  } catch (e) {
    mostrarMensagem('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  }
});

botaoCancelar.addEventListener('click', () => {
  limparFormulario();
  mostrarMensagem('', '');
});

async function excluirAluno(aluno) {
  if (!confirm(`Excluir o aluno ${aluno.nome}?`)) return;

  try {
    const resposta = await fetch(`${API_URL}/${aluno.id}`, { method: 'DELETE', headers: Sessao.cabecalho() });
    const corpo = await resposta.json();

    if (resposta.status === 401) {
      Sessao.encerrar();
      window.location.href = 'login.html';
      return;
    }

    if (corpo.status !== 'ok') {
      return mostrarMensagem(corpo.message, 'erro');
    }
    mostrarMensagem('Aluno excluído.', 'sucesso');
    limparFormulario();
    carregarAlunos();
  } catch (e) {
    mostrarMensagem('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  }
}

carregarAlunos();
