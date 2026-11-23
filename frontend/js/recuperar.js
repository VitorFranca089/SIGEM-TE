const formularioRecuperar = document.getElementById('formulario-recuperar');
const mensagemRecuperar = document.getElementById('mensagem');

formularioRecuperar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const botao = formularioRecuperar.querySelector('button[type="submit"]');
  botao.disabled = true;
  mensagemRecuperar.className = 'mensagem';
  mensagemRecuperar.textContent = 'Enviando código...';
  try {
    const resposta = await fetch('/api/auth/recuperar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('email').value.trim() })
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      mensagemRecuperar.className = 'mensagem erro';
      mensagemRecuperar.textContent = corpo.message || 'Não foi possível solicitar a recuperação.';
      return;
    }
    mensagemRecuperar.className = 'mensagem sucesso';
    mensagemRecuperar.textContent = `${corpo.message} Confira também a caixa de spam. Depois, abra a tela de redefinição.`;
  } catch (erro) {
    mensagemRecuperar.className = 'mensagem erro';
    mensagemRecuperar.textContent = 'Não foi possível falar com o backend. Ele está rodando?';
  } finally {
    botao.disabled = false;
  }
});
