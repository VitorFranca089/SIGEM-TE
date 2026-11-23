// Tela de arquivos: materiais do professor (RF07) e audios de pratica dos
// alunos (RF08). Sem framework, conforme o RNF02.
//
// A mesma tela serve aos tres perfis, escolhidos pelo perfil de quem esta
// logado:
//   - o aluno ve o material que recebeu, envia e ouve as proprias gravacoes;
//   - o professor e o administrador enviam material para uma turma ou um
//     aluno, veem os materiais (o professor, os que enviou; o admin, todos) e
//     escolhem um aluno para ouvir as gravacoes dele.
//
// O ponto nao obvio: o arquivo NAO e tocado com <audio src="/api/arquivos/1">.
// O navegador busca o src de um <audio> sozinho, sem o cabecalho Authorization,
// e a rota recusaria com 401. Por isso o JavaScript busca o arquivo com fetch
// (levando o token), recebe o conteudo como um blob (um arquivo guardado na
// memoria do navegador) e entrega ao player um endereco local que aponta para
// esse blob. O botao de baixar usa o mesmo caminho, e e por isso que ele
// tambem funciona para o PDF.

// Endereco relativo: a CSP do servidor so deixa a tela chamar o proprio
// endereco dela, e com 'http://localhost:3000' escrito por extenso quem abrisse
// o sistema por 127.0.0.1:3000 ficava sem conseguir falar com a API.
const API_URL = '/api';

// Repete o limite do servidor (middlewares/upload.js) so por conforto: avisa
// na hora, em vez de deixar a pessoa esperar o envio de 80 MB para ouvir nao.
// Quem recusa de verdade e o servidor. Vale para a gravacao e para o material,
// que la tambem tem o mesmo limite.
const TAMANHO_MAXIMO_MB = 50;

const blocoSemLogin = document.getElementById('bloco-sem-login');

// RF07
const blocoEnvioMaterial = document.getElementById('bloco-envio-material');
const formularioMaterial = document.getElementById('formulario-material');
const campoMaterial = document.getElementById('arquivo-material');
const opcoesDestino = document.querySelectorAll('input[name="destino"]');
const destinoTurma = document.getElementById('destino-turma');
const destinoAluno = document.getElementById('destino-aluno');
const escolhaTurma = document.getElementById('escolha-turma');
const escolhaAlunoDestino = document.getElementById('escolha-aluno-destino');
const botaoEnviarMaterial = document.getElementById('botao-enviar-material');
const mensagemMateriais = document.getElementById('mensagem-materiais');
const blocoMateriais = document.getElementById('bloco-materiais');
const tituloMateriais = document.getElementById('titulo-materiais');
const listaMateriais = document.getElementById('lista-materiais');

// RF08
const blocoEnvio = document.getElementById('bloco-envio');
const blocoEscolha = document.getElementById('bloco-escolha');
const blocoLista = document.getElementById('bloco-lista');
const formularioEnvio = document.getElementById('formulario-envio');
const campoArquivo = document.getElementById('arquivo-audio');
const botaoEnviar = document.getElementById('botao-enviar');
const escolhaAluno = document.getElementById('escolha-aluno');
const tituloLista = document.getElementById('titulo-lista');
const listaAudios = document.getElementById('lista-audios');
const mensagem = document.getElementById('mensagem');

const usuarioLogado = Sessao.usuario();

// Enderecos locais criados para os blobs. Cada um prende o arquivo inteiro na
// memoria ate ser liberado, entao sao liberados sempre que a lista e
// redesenhada. Um grupo por lista: redesenhar as gravacoes nao pode soltar o
// audio de um material que esta tocando.
const enderecosPraticas = [];
const enderecosMateriais = [];

function liberarEnderecos(enderecos) {
  enderecos.forEach((endereco) => URL.revokeObjectURL(endereco));
  enderecos.length = 0;
}

// Cada parte da tela tem a propria linha de mensagem, logo abaixo do proprio
// formulario. Com uma so, o aviso de um envio de material sairia la embaixo,
// junto das gravacoes, fora da vista de quem clicou em Enviar.
function mostrarMensagem(texto, tipo, alvo = mensagem) {
  alvo.textContent = texto;
  alvo.className = 'mensagem ' + tipo;
}

// Erro lancado quando a sessao acabou e a tela ja esta indo para o login: os
// catch abaixo reconhecem e ficam quietos, em vez de mostrar "o backend esta
// rodando?" por um instante antes de a pagina trocar.
class SessaoEncerrada extends Error {}

// Erro com uma mensagem que veio do servidor, em portugues, pronta para a tela.
// Separado de um erro de rede, cuja mensagem vem do navegador ("Failed to
// fetch") e nao diz nada a quem esta usando.
class ErroDaApi extends Error {}

function falhaDeConexao(e, alvo = mensagem) {
  if (e instanceof SessaoEncerrada) return;
  if (e instanceof ErroDaApi) return mostrarMensagem(e.message, 'erro', alvo);
  mostrarMensagem('Não foi possível falar com o backend. Ele está rodando?', 'erro', alvo);
}

// Toda chamada desta tela passa por aqui, para o token ir sempre junto e o 401
// ser tratado num lugar so.
//
// 401 e 403 sao tratados diferente de proposito: 401 quer dizer "nao sei quem
// e voce" (sessao vencida), e mandar para o login resolve. 403 quer dizer "sei,
// e voce nao pode" - logar de novo devolveria o mesmo perfil, entao so a
// mensagem aparece, e quem chamou decide.
async function chamarApi(caminho, opcoes = {}) {
  const resposta = await fetch(API_URL + caminho, {
    ...opcoes,
    headers: { ...(opcoes.headers || {}), ...Sessao.cabecalho() }
  });
  if (resposta.status === 401) {
    Sessao.encerrar();
    window.location.href = 'login.html';
    throw new SessaoEncerrada();
  }
  return resposta;
}

// Acrescenta as opcoes a uma lista de escolha, depois da primeira ("Escolha
// ..."). Com a lista vazia, troca o texto da primeira: a pessoa entende por que
// nao ha o que escolher, em vez de achar que a tela travou.
function preencherEscolha(escolha, itens, textoDoItem, textoSeVazio) {
  if (itens.length === 0) escolha.options[0].textContent = textoSeVazio;
  for (const item of itens) {
    const opcao = document.createElement('option');
    opcao.value = item.id;
    // textContent: o nome veio do banco, e foi digitado por alguem.
    opcao.textContent = textoDoItem(item);
    escolha.appendChild(opcao);
  }
}

// As listas de escolha do professor e do administrador. Os alunos vem uma vez
// so e servem as duas listas: a de destino do material e a de quem ouvir. O
// servidor ja devolve ao professor so os alunos das turmas ativas dele - a
// mesma regra que ele confere no envio do material.
async function carregarEscolhas() {
  try {
    const [respostaTurmas, respostaAlunos] = await Promise.all([
      chamarApi('/turmas'),
      chamarApi('/alunos')
    ]);
    const turmas = await respostaTurmas.json();
    const alunos = await respostaAlunos.json();
    if (turmas.status !== 'ok') return mostrarMensagem(turmas.message, 'erro', mensagemMateriais);
    if (alunos.status !== 'ok') return mostrarMensagem(alunos.message, 'erro', mensagemMateriais);

    // GET /api/turmas devolve tambem as solicitadas e as encerradas. So turma
    // ativa recebe material: com outra, o envio levaria 404.
    const ativas = turmas.dados.filter((turma) => turma.status === 'ativa');
    preencherEscolha(escolhaTurma, ativas, (turma) => turma.nome + ' - ' + turma.curso_nome, 'Nenhuma turma ativa');
    preencherEscolha(escolhaAlunoDestino, alunos.dados, (aluno) => aluno.nome, 'Nenhum aluno disponível');
    preencherEscolha(escolhaAluno, alunos.dados, (aluno) => aluno.nome, 'Nenhum aluno disponível');
  } catch (e) {
    falhaDeConexao(e, mensagemMateriais);
  }
}

function destinoEhAluno() {
  return document.querySelector('input[name="destino"]:checked').value === 'aluno';
}

// Mostra so a lista do destino marcado. A outra, alem de escondida, fica
// desligada (disabled): o navegador nao cobra o "required" de campo desligado.
// Ligada e escondida, ela travaria o envio por estar vazia, sem a pessoa nem
// ver de onde vem o problema.
function atualizarDestino() {
  const paraAluno = destinoEhAluno();
  destinoTurma.hidden = paraAluno;
  destinoAluno.hidden = !paraAluno;
  escolhaTurma.disabled = paraAluno;
  escolhaAlunoDestino.disabled = !paraAluno;
}

// Busca o conteudo do arquivo com o token e devolve um endereco local para ele.
async function buscarEnderecoLocal(arquivo, enderecos) {
  const resposta = await chamarApi('/arquivos/' + arquivo.id);
  if (!resposta.ok) {
    const corpo = await resposta.json();
    throw new ErroDaApi(corpo.message);
  }
  const conteudo = await resposta.blob();
  const endereco = URL.createObjectURL(conteudo);
  enderecos.push(endereco);
  return endereco;
}

// Monta o cartao de um arquivo, nas duas listas da tela. O que muda de uma
// lista para a outra chega em "opcoes":
//   detalhes: as linhas abaixo do nome (data, destino, quem enviou)
//   podeExcluir e aoExcluir: se o botao Excluir aparece, e o que ele faz
//   enderecos: o grupo de enderecos locais da lista (ver liberarEnderecos)
//   alvo: a linha de mensagem onde os erros desta lista aparecem
function montarItem(arquivo, { detalhes, podeExcluir, aoExcluir, enderecos, alvo }) {
  const item = document.createElement('li');
  item.className = 'item-audio';

  const nome = document.createElement('strong');
  nome.textContent = arquivo.nome_original;
  item.appendChild(nome);

  for (const texto of detalhes) {
    const linha = document.createElement('span');
    linha.className = 'ajuda';
    linha.textContent = texto;
    item.appendChild(linha);
  }

  const player = document.createElement('audio');
  player.controls = true;
  player.hidden = true;

  // O arquivo so e baixado quando a pessoa pede. Carregar todos ao abrir a tela
  // baixaria, de uma vez, cada arquivo da lista - com WAVs de 50 MB, isso
  // chegaria facil a centenas de megabytes.
  let endereco = null;
  async function garantirEndereco() {
    if (!endereco) endereco = await buscarEnderecoLocal(arquivo, enderecos);
    return endereco;
  }

  const acoes = document.createElement('div');
  acoes.className = 'item-audio-acoes';

  // So audio tem "Ouvir": um PDF no player so daria erro. A gravacao de
  // pratica e sempre audio; o material do professor pode ser PDF.
  if (arquivo.tipo?.startsWith('audio/')) {
    const ouvir = document.createElement('button');
    ouvir.type = 'button';
    ouvir.textContent = 'Ouvir';
    ouvir.addEventListener('click', async () => {
      ouvir.disabled = true;
      ouvir.textContent = 'Carregando...';
      try {
        player.src = await garantirEndereco();
        player.hidden = false;
        ouvir.hidden = true;
        // O navegador so deixa tocar som sozinho logo depois de um clique. Se o
        // arquivo demorou a chegar, ele recusa - e tudo bem: o player ja esta na
        // tela, e a pessoa aperta o play.
        player.play().catch(() => {});
      } catch (e) {
        ouvir.disabled = false;
        ouvir.textContent = 'Ouvir';
        falhaDeConexao(e, alvo);
      }
    });
    acoes.appendChild(ouvir);
  }

  const baixar = document.createElement('button');
  baixar.type = 'button';
  baixar.className = 'secundario';
  baixar.textContent = 'Baixar';
  baixar.addEventListener('click', async () => {
    try {
      // Um link com o atributo "download" apontando para o blob, clicado pelo
      // proprio script: e o jeito de "salvar como" um conteudo que ja esta na
      // memoria. O nome sugerido e o original, nao o nome aleatorio do disco.
      const link = document.createElement('a');
      link.href = await garantirEndereco();
      link.download = arquivo.nome_original;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      falhaDeConexao(e, alvo);
    }
  });
  acoes.appendChild(baixar);

  // O servidor confere de novo quem pode apagar: esconder o botao e so para
  // nao oferecer o que daria erro.
  if (podeExcluir) {
    const excluir = document.createElement('button');
    excluir.type = 'button';
    excluir.className = 'perigo';
    excluir.textContent = 'Excluir';
    excluir.addEventListener('click', aoExcluir);
    acoes.appendChild(excluir);
  }

  item.append(acoes, player);
  return item;
}

// "Para a turma X" ou "Para Fulano". O aluno le "So para voce" no material
// pessoal: o proprio nome ali so faria ele parar para entender.
function destinoDoMaterial(material) {
  if (material.turma_id) return 'Para a turma ' + material.turma_nome;
  if (usuarioLogado.perfil === 'aluno') return 'Só para você';
  return 'Para ' + material.aluno_nome;
}

async function carregarMateriais() {
  try {
    const resposta = await chamarApi('/arquivos/materiais');
    const corpo = await resposta.json();
    if (corpo.status !== 'ok') return mostrarMensagem(corpo.message, 'erro', mensagemMateriais);

    liberarEnderecos(enderecosMateriais);
    listaMateriais.replaceChildren();

    if (corpo.dados.length === 0) {
      const vazio = document.createElement('li');
      vazio.textContent = 'Nenhum material ainda.';
      listaMateriais.appendChild(vazio);
      return;
    }

    // Na lista do professor, tudo foi ele que enviou: o nome dele em cada
    // cartao so repetiria.
    const mostrarAutor = usuarioLogado.perfil !== 'professor';

    for (const material of corpo.dados) {
      const enviado = mostrarAutor
        ? 'Enviado por ' + material.enviado_por + ' em ' + material.enviado_em
        : 'Enviado em ' + material.enviado_em;

      listaMateriais.appendChild(montarItem(material, {
        detalhes: [destinoDoMaterial(material), enviado],
        // So quem enviou apaga. O admin ve todos os materiais, mas so os dele
        // tem Excluir - por isso o id, e nao o nome, que pode se repetir.
        podeExcluir: material.enviado_por_id === usuarioLogado.id,
        aoExcluir: () => excluirMaterial(material),
        enderecos: enderecosMateriais,
        alvo: mensagemMateriais
      }));
    }
  } catch (e) {
    falhaDeConexao(e, mensagemMateriais);
  }
}

async function excluirMaterial(material) {
  if (!confirm('Excluir o material ' + material.nome_original + '? Quem recebeu deixa de ver. Não dá para desfazer.')) return;

  try {
    const resposta = await chamarApi('/arquivos/' + material.id, { method: 'DELETE' });
    const corpo = await resposta.json();
    if (corpo.status !== 'ok') return mostrarMensagem(corpo.message, 'erro', mensagemMateriais);

    // O texto e da tela, como o "Gravacao excluida.": o servidor responde
    // "Arquivo excluido" para os dois.
    mostrarMensagem('Material excluído.', 'sucesso', mensagemMateriais);
    carregarMateriais();
  } catch (e) {
    falhaDeConexao(e, mensagemMateriais);
  }
}

async function carregarAudios(alunoId) {
  const caminho = alunoId
    ? '/arquivos/praticas?aluno_id=' + encodeURIComponent(alunoId)
    : '/arquivos/praticas';

  try {
    const resposta = await chamarApi(caminho);
    const corpo = await resposta.json();
    if (corpo.status !== 'ok') return mostrarMensagem(corpo.message, 'erro');

    liberarEnderecos(enderecosPraticas);
    listaAudios.replaceChildren();

    if (corpo.dados.length === 0) {
      const vazio = document.createElement('li');
      vazio.textContent = 'Nenhuma gravação enviada ainda.';
      listaAudios.appendChild(vazio);
      return;
    }

    for (const arquivo of corpo.dados) {
      listaAudios.appendChild(montarItem(arquivo, {
        detalhes: ['Enviado em ' + arquivo.enviado_em],
        // So o aluno ve o proprio envio, e so quem enviou pode apagar.
        podeExcluir: usuarioLogado.perfil === 'aluno',
        aoExcluir: () => excluirAudio(arquivo),
        enderecos: enderecosPraticas,
        alvo: mensagem
      }));
    }
  } catch (e) {
    falhaDeConexao(e);
  }
}

async function excluirAudio(arquivo) {
  if (!confirm('Excluir a gravação ' + arquivo.nome_original + '? Não dá para desfazer.')) return;

  try {
    const resposta = await chamarApi('/arquivos/' + arquivo.id, { method: 'DELETE' });
    const corpo = await resposta.json();
    if (corpo.status !== 'ok') return mostrarMensagem(corpo.message, 'erro');

    mostrarMensagem('Gravação excluída.', 'sucesso');
    carregarAudios();
  } catch (e) {
    falhaDeConexao(e);
  }
}

formularioMaterial.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const arquivo = campoMaterial.files[0];
  if (!arquivo) return;

  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return mostrarMensagem('O arquivo passa do limite de ' + TAMANHO_MAXIMO_MB + ' MB', 'erro', mensagemMateriais);
  }

  // "arquivo" e o nome do campo que o servidor espera para o material. Vai so
  // o destino marcado: o servidor recusa turma_id e aluno_id juntos.
  const dados = new FormData();
  dados.append('arquivo', arquivo);
  if (destinoEhAluno()) {
    dados.append('aluno_id', escolhaAlunoDestino.value);
  } else {
    dados.append('turma_id', escolhaTurma.value);
  }

  botaoEnviarMaterial.disabled = true;
  botaoEnviarMaterial.textContent = 'Enviando...';
  mostrarMensagem('Enviando. Arquivos grandes podem levar alguns minutos.', '', mensagemMateriais);

  try {
    // Sem 'Content-Type' nos cabecalhos, pelo mesmo motivo do envio da
    // gravacao, mais abaixo.
    const resposta = await chamarApi('/arquivos/materiais', { method: 'POST', body: dados });
    const corpo = await resposta.json();
    if (corpo.status !== 'ok') return mostrarMensagem(corpo.message, 'erro', mensagemMateriais);

    mostrarMensagem('Material enviado.', 'sucesso', mensagemMateriais);
    // Limpa so o arquivo, e nao o destino: quem manda varios arquivos para a
    // mesma turma nao precisa escolher a turma de novo a cada um.
    campoMaterial.value = '';
    carregarMateriais();
  } catch (e) {
    falhaDeConexao(e, mensagemMateriais);
  } finally {
    botaoEnviarMaterial.disabled = false;
    botaoEnviarMaterial.textContent = 'Enviar';
  }
});

formularioEnvio.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const arquivo = campoArquivo.files[0];
  if (!arquivo) return;

  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return mostrarMensagem('O arquivo passa do limite de ' + TAMANHO_MAXIMO_MB + ' MB', 'erro');
  }

  // FormData monta o corpo no formato multipart/form-data, o mesmo de um
  // formulario HTML com arquivo. "audio" e o nome do campo que o servidor espera.
  const dados = new FormData();
  dados.append('audio', arquivo);

  botaoEnviar.disabled = true;
  botaoEnviar.textContent = 'Enviando...';
  mostrarMensagem('Enviando. Arquivos grandes podem levar alguns minutos.', '');

  try {
    // Sem 'Content-Type' nos cabecalhos, de proposito. Com FormData, o
    // navegador escreve esse cabecalho sozinho, incluindo o "boundary" - a
    // linha marcadora que separa os pedacos do corpo. Escrever
    // 'multipart/form-data' a mao apagaria o boundary, e o servidor nao
    // conseguiria recortar o arquivo.
    const resposta = await chamarApi('/arquivos/praticas', { method: 'POST', body: dados });
    const corpo = await resposta.json();
    if (corpo.status !== 'ok') return mostrarMensagem(corpo.message, 'erro');

    mostrarMensagem('Gravação enviada.', 'sucesso');
    formularioEnvio.reset();
    carregarAudios();
  } catch (e) {
    falhaDeConexao(e);
  } finally {
    botaoEnviar.disabled = false;
    botaoEnviar.textContent = 'Enviar';
  }
});

opcoesDestino.forEach((opcao) => opcao.addEventListener('change', atualizarDestino));

escolhaAluno.addEventListener('change', () => {
  mostrarMensagem('', '');
  if (!escolhaAluno.value) {
    blocoLista.hidden = true;
    return;
  }
  const nomeAluno = escolhaAluno.options[escolhaAluno.selectedIndex].textContent;
  tituloLista.textContent = 'Gravações de ' + nomeAluno;
  blocoLista.hidden = false;
  carregarAudios(escolhaAluno.value);
});

// Decide o que a tela mostra. Esconder um bloco nao e seguranca - a rota
// recusaria do mesmo jeito -, e so para cada perfil ver o que faz sentido.
if (!usuarioLogado) {
  blocoSemLogin.hidden = false;
} else if (usuarioLogado.perfil === 'aluno') {
  tituloMateriais.textContent = 'Materiais recebidos';
  blocoMateriais.hidden = false;
  blocoEnvio.hidden = false;
  blocoLista.hidden = false;
  carregarMateriais();
  carregarAudios();
} else {
  tituloMateriais.textContent = usuarioLogado.perfil === 'admin' ? 'Todos os materiais' : 'Materiais enviados';
  blocoEnvioMaterial.hidden = false;
  blocoMateriais.hidden = false;
  blocoEscolha.hidden = false;
  // O Firefox lembra o radio marcado ao recarregar a pagina. Sem isto, "Um
  // aluno" podia voltar marcado com a lista de turmas na tela.
  atualizarDestino();
  carregarEscolhas();
  carregarMateriais();
}
