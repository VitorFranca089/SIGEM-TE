const resultadosPesquisa = document.getElementById('resultados-pesquisa');
const campoPesquisa = document.getElementById('campo-pesquisa');
const tituloResultados = document.getElementById('titulo-resultados');
const mensagemPesquisa = document.createElement('p');
mensagemPesquisa.className = 'mensagem';
resultadosPesquisa.parentElement.appendChild(mensagemPesquisa);
let filtroPesquisa = 'todos';
let requisicaoAtual = 0;

function renderizarResultados(encontrados) {
  tituloResultados.textContent = campoPesquisa.value.trim() || filtroPesquisa !== 'todos'
    ? `${encontrados.length} resultado(s)`
    : 'Tudo para você explorar';
  resultadosPesquisa.replaceChildren();
  if (encontrados.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'cartao empty-state';
    vazio.textContent = 'Nenhum resultado encontrado. Tente outro termo ou categoria.';
    resultadosPesquisa.appendChild(vazio);
    return;
  }

  encontrados.forEach((item) => {
    const card = document.createElement('a');
    card.className = 'cartao search-result';
    card.href = item.link || '#';

    const icone = document.createElement('span');
    icone.className = 'search-result-icon';
    icone.textContent = item.icone || '♫';

    const texto = document.createElement('div');
    const rotulo = document.createElement('p');
    rotulo.className = 'overline';
    rotulo.textContent = item.tipo || '';
    const titulo = document.createElement('h3');
    titulo.textContent = item.titulo || '';
    const detalhe = document.createElement('p');
    detalhe.textContent = item.detalhe || '';
    texto.append(rotulo, titulo, detalhe);
    card.append(icone, texto, document.createTextNode('→'));
    resultadosPesquisa.appendChild(card);
  });
}

async function carregarPesquisa() {
  const numeroDaRequisicao = ++requisicaoAtual;
  mensagemPesquisa.textContent = '';
  try {
    const parametros = new URLSearchParams({
      q: campoPesquisa.value.trim(),
      tipo: filtroPesquisa
    });
    const resposta = await fetch(`/api/pesquisa?${parametros}`, {
      headers: Sessao.cabecalho()
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (numeroDaRequisicao !== requisicaoAtual) return;
    if (resposta.status === 401) {
      mensagemPesquisa.textContent = 'Entre no sistema para pesquisar no catálogo.';
      mensagemPesquisa.className = 'mensagem erro';
      return;
    }
    if (!resposta.ok || corpo.status !== 'ok') throw new Error(corpo.message);
    mensagemPesquisa.className = 'mensagem';
    renderizarResultados(corpo.dados);
  } catch (erro) {
    if (numeroDaRequisicao !== requisicaoAtual) return;
    resultadosPesquisa.replaceChildren();
    tituloResultados.textContent = 'Pesquisa indisponível';
    mensagemPesquisa.textContent = 'Não foi possível consultar o catálogo agora.';
    mensagemPesquisa.className = 'mensagem erro';
  }
}

campoPesquisa.addEventListener('input', carregarPesquisa);
document.querySelectorAll('[data-filtro]').forEach((botao) => botao.addEventListener('click', () => {
  filtroPesquisa = botao.dataset.filtro;
  document.querySelectorAll('[data-filtro]').forEach((item) => item.classList.toggle('selecionado', item === botao));
  carregarPesquisa();
}));

carregarPesquisa();
