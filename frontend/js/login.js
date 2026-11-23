// Tela de login (RF06). Sem framework, conforme o RNF02.

// Endereco relativo: a CSP do servidor so deixa a tela chamar o proprio
// endereco dela, e com 'http://localhost:3000' escrito por extenso quem abrisse
// o sistema por 127.0.0.1:3000 ficava sem conseguir falar com a API.
const API_URL = '/api/auth';

const formulario = document.getElementById('formulario-login');
const campoEmail = document.getElementById('email');
const campoSenha = document.getElementById('senha');
const botaoVerSenha = document.getElementById('botao-ver-senha');
const botaoEntrar = document.getElementById('botao-entrar');
const mensagem = document.getElementById('mensagem');

function atualizarBotaoSenha() {
  const visivel = campoSenha.type === 'text';
  botaoVerSenha.textContent = visivel ? 'Ocultar' : 'Mostrar';
  botaoVerSenha.setAttribute('aria-pressed', String(visivel));
  botaoVerSenha.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
}

// Mostrar/ocultar a senha: trocar o type do input nao apaga o valor digitado.
botaoVerSenha.addEventListener('click', () => {
  const escondida = campoSenha.type === 'password';
  campoSenha.type = escondida ? 'text' : 'password';
  atualizarBotaoSenha();
});
atualizarBotaoSenha();

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = 'mensagem ' + tipo;
}

// Repare que o campo de senha NAO tem minlength no HTML, ao contrario do
// cadastro. Duas razoes: exigir 8 caracteres aqui contaria a quem nao tem conta
// qual e a regra de senha do sistema, e um dia a regra pode mudar e deixar
// senhas antigas mais curtas validas - o formulario de entrar nao pode barrar
// quem ja tem uma senha legitima. Quem decide se a senha esta certa e o
// servidor, comparando com o hash.
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  // Trava o botao durante a requisicao: sem isso, dois cliques rapidos mandam
  // dois logins e a segunda resposta pode chegar depois do redirecionamento.
  botaoEntrar.disabled = true;
  mostrarMensagem('Entrando...', '');

  try {
    const resposta = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: campoEmail.value.trim(),
        senha: campoSenha.value
      })
    });
    const corpo = await resposta.json();

    if (corpo.status !== 'ok') {
      // A mensagem vem pronta do servidor e e a mesma para e-mail que nao
      // existe e para senha errada - de proposito, para a tela nao virar um
      // verificador de quais e-mails tem conta no sistema.
      mostrarMensagem(corpo.message, 'erro');
      campoSenha.value = '';
      campoSenha.focus();
      return;
    }

    // Guarda token e usuario pelo Sessao, nunca escrevendo no sessionStorage
    // direto daqui: os nomes das chaves moram num arquivo so.
    Sessao.salvar(corpo.dados.token, corpo.dados.usuario);
    const destinos = {
      // Classes mostra o que e do aluno de verdade (turmas e presencas). A
      // antiga "Pagina do aluno" tinha cartoes fixos, que nao vinham do banco.
      aluno: 'classes.html',
      professor: 'turmas.html',
      admin: 'index.html'
    };
    window.location.href = destinos[corpo.dados.usuario.perfil] || 'index.html';
  } catch (e) {
    mostrarMensagem('Não foi possível falar com o backend. Ele está rodando?', 'erro');
  } finally {
    // finally roda mesmo depois do return la em cima, entao o botao volta a
    // funcionar em qualquer caminho que nao tenha trocado de pagina.
    botaoEntrar.disabled = false;
  }
});
