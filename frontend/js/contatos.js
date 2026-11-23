const listaDocentes = document.getElementById('lista-docentes');
const mensagemContatos = document.getElementById('mensagem');

function cartaoDocente(docente) {
  const cartao = document.createElement('article');
  cartao.className = 'cartao contact-card';
  const icone = document.createElement('span');
  icone.className = 'contact-icon';
  icone.textContent = '◉';
  const conteudo = document.createElement('div');
  const tipo = document.createElement('p');
  tipo.className = 'overline';
  tipo.textContent = 'Docente';
  const nome = document.createElement('h3');
  nome.textContent = docente.nome;
  const especialidades = document.createElement('p');
  especialidades.textContent = docente.especialidades || 'Professor SIGEM';
  const email = document.createElement('a');
  email.href = `mailto:${docente.email}`;
  email.textContent = docente.email;
  const chat = document.createElement('button');
  chat.type = 'button';
  chat.className = 'secundario pequeno chat-indisponivel';
  chat.textContent = 'Chat direto em breve';
  chat.disabled = true;
  conteudo.append(tipo, nome, especialidades, email, chat);
  cartao.append(icone, conteudo);
  return cartao;
}

async function carregarDocentes() {
  try {
    const resposta = await fetch('/api/professores', { headers: Sessao.cabecalho() });
    const corpo = await resposta.json().catch(() => ({}));
    if (resposta.status === 401) {
      mensagemContatos.textContent = 'Entre no sistema para consultar os contatos docentes.';
      mensagemContatos.className = 'mensagem erro';
      return;
    }
    if (!resposta.ok || corpo.status !== 'ok') throw new Error(corpo.message);
    if (corpo.dados.length === 0) {
      mensagemContatos.textContent = 'Nenhum docente cadastrado ainda.';
      return;
    }
    corpo.dados.forEach((docente) => listaDocentes.appendChild(cartaoDocente(docente)));
  } catch (erro) {
    mensagemContatos.textContent = 'Não foi possível carregar os contatos docentes.';
    mensagemContatos.className = 'mensagem erro';
  }
}

carregarDocentes();
