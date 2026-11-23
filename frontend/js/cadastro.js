// Cadastro publico de aluno. Professor nao se cadastra sozinho: quem cria a
// conta dele e o administrador, na tela de Professores (ver professor.routes.js).
const formularioCadastro = document.getElementById('formulario-cadastro');
const mensagemCadastro = document.getElementById('mensagem');
const senhaCadastro = document.getElementById('senha');
const confirmacaoCadastro = document.getElementById('senha-confirmacao');
const botaoMostrarSenha = document.getElementById('mostrar-senha');
const dicaSenhaCadastro = document.getElementById('dica-senha');

function mostrarMensagemCadastro(texto, tipo) {
  mensagemCadastro.textContent = texto;
  mensagemCadastro.className = 'mensagem ' + tipo;
}

botaoMostrarSenha.addEventListener('click', () => {
  const escondida = senhaCadastro.type === 'password';
  senhaCadastro.type = escondida ? 'text' : 'password';
  botaoMostrarSenha.textContent = escondida ? 'Ocultar' : 'Mostrar';
});

function atualizarDicaSenha() {
  const senha = senhaCadastro.value;
  const faltantes = [];
  if (senha.length < 8) faltantes.push('8 caracteres');
  if (!/[A-Z]/.test(senha)) faltantes.push('uma maiúscula');
  if (!/[a-z]/.test(senha)) faltantes.push('uma minúscula');
  if (!/[0-9]/.test(senha)) faltantes.push('um número');
  if (!/[^A-Za-z0-9]/.test(senha)) faltantes.push('um caractere especial');
  dicaSenhaCadastro.textContent = faltantes.length === 0
    ? 'Senha forte.'
    : 'Falta: ' + faltantes.join(', ') + '.';
  dicaSenhaCadastro.className = 'ajuda ' + (faltantes.length === 0 ? 'forte' : 'fraca');
}

senhaCadastro.addEventListener('input', atualizarDicaSenha);

formularioCadastro.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (senhaCadastro.value !== confirmacaoCadastro.value) {
    confirmacaoCadastro.setCustomValidity('As senhas não coincidem');
    confirmacaoCadastro.reportValidity();
    return;
  }
  confirmacaoCadastro.setCustomValidity('');

  const dados = {
    nome: document.getElementById('nome').value.trim(),
    email: document.getElementById('email').value.trim(),
    senha: senhaCadastro.value,
    senha_confirmacao: confirmacaoCadastro.value,
    data_nascimento: document.getElementById('data-nascimento').value || null
  };

  const botaoEnviar = formularioCadastro.querySelector('button[type="submit"]');
  botaoEnviar.disabled = true;
  mostrarMensagemCadastro('Criando cadastro...', '');
  try {
    const resposta = await fetch('/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok || corpo.status !== 'ok') {
      mostrarMensagemCadastro(corpo.message || 'Não foi possível criar o cadastro.', 'erro');
      return;
    }
    mostrarMensagemCadastro('Cadastro criado com sucesso! Redirecionando para o login...', 'sucesso');
    setTimeout(() => { window.location.href = 'login.html'; }, 900);
  } catch (erro) {
    mostrarMensagemCadastro('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  } finally {
    botaoEnviar.disabled = false;
  }
});
