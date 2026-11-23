const formularioRedefinir = document.getElementById('formulario-redefinir');
const mensagemRedefinir = document.getElementById('mensagem');
const novaSenhaRedefinir = document.getElementById('nova-senha');
const confirmacaoRedefinir = document.getElementById('confirmacao-senha');
const mostrarSenhaRedefinir = document.getElementById('mostrar-senha');

mostrarSenhaRedefinir.addEventListener('click', () => {
  const escondida = novaSenhaRedefinir.type === 'password';
  novaSenhaRedefinir.type = escondida ? 'text' : 'password';
  mostrarSenhaRedefinir.textContent = escondida ? 'Ocultar' : 'Mostrar';
});

formularioRedefinir.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (novaSenhaRedefinir.value !== confirmacaoRedefinir.value) {
    confirmacaoRedefinir.setCustomValidity('As senhas não coincidem');
    confirmacaoRedefinir.reportValidity();
    return;
  }
  confirmacaoRedefinir.setCustomValidity('');
  const botao = formularioRedefinir.querySelector('button[type="submit"]');
  botao.disabled = true;
  mensagemRedefinir.className = 'mensagem';
  mensagemRedefinir.textContent = 'Redefinindo senha...';
  try {
    const resposta = await fetch('/api/auth/redefinir-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        codigo: document.getElementById('codigo').value.trim(),
        nova_senha: novaSenhaRedefinir.value,
        confirmacao_senha: confirmacaoRedefinir.value
      })
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      mensagemRedefinir.className = 'mensagem erro';
      mensagemRedefinir.textContent = corpo.message || 'Não foi possível redefinir a senha.';
      return;
    }
    mensagemRedefinir.className = 'mensagem sucesso';
    mensagemRedefinir.textContent = 'Senha redefinida com sucesso. Você já pode entrar no SIGEM.';
    formularioRedefinir.reset();
  } catch (erro) {
    mensagemRedefinir.className = 'mensagem erro';
    mensagemRedefinir.textContent = 'Não foi possível falar com o backend. Ele está rodando?';
  } finally {
    botao.disabled = false;
  }
});
