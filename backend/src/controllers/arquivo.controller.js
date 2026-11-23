// Controller de arquivos: RF08 (o aluno envia audio das proprias praticas) e
// RF07 (o professor envia material para uma turma ou para um aluno).
//
// O arquivo em si fica no disco, em backend/uploads/, com nome aleatorio. A
// tabela "arquivo" guarda so onde ele esta e os dados para mostra-lo: quem
// enviou, para qual aluno, o tipo e o nome original.
//
// Como se distingue uma PRATICA de um material do professor, se os dois usam a
// mesma tabela? Pelo remetente. O RF07 tambem preenche aluno_id quando o
// professor manda algo para um aluno especifico - entao aluno_id preenchido nao
// basta. Pratica e o arquivo que o PROPRIO aluno enviou: arquivo.usuario_id
// igual ao usuario_id do aluno. Isso dispensa uma coluna nova e uma migracao.

const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const { PASTA_UPLOADS } = require('../middlewares/upload');
const { notificar } = require('../utils/notificacoes');

function erro(res, status, message, detalhe) {
  return res.status(status).json({ status: 'erro', message, detalhe });
}

// A mesma resposta para "nao existe" e "existe, mas nao e seu". Com 403 no
// segundo caso, um aluno descobriria quais numeros de arquivo existem testando
// um por um - a mesma logica da mensagem unica do login.
const NAO_ENCONTRADO = 'Arquivo não encontrado';

// Os ids chegam na URL como texto. Sem esta conferencia, "/api/arquivos/abc"
// chegaria ao PostgreSQL e voltaria como erro 500, quando o erro e de quem
// pediu (400).
function idValido(valor) {
  return /^[1-9][0-9]*$/.test(String(valor));
}

// Apaga um arquivo do disco sem deixar a falha subir. Usado quando a gravacao
// no banco da errado depois de o multer ja ter salvo o arquivo: sem isto,
// sobraria no disco um arquivo que nenhuma linha do banco aponta - ocupando
// espaco para sempre, invisivel para o sistema.
async function apagarDoDisco(caminho) {
  try {
    await fs.unlink(path.join(PASTA_UPLOADS, caminho));
  } catch (e) {
    // Arquivo que ja nao existe nao e problema: o objetivo era ele nao existir.
    if (e.code !== 'ENOENT') console.error('Falha ao apagar ' + caminho, e.message);
  }
}

// Colunas devolvidas nas listagens. caminho fica de fora de proposito: o nome
// no disco nao interessa a tela, e quem baixa passa pela rota com o id.
// A data vira texto no SQL pelo mesmo motivo das datas de aluno: o Date do
// JavaScript desloca o horario conforme o fuso.
const COLUNAS = `
  ar.id,
  ar.nome_original,
  ar.tipo,
  TO_CHAR(ar.enviado_em, 'DD/MM/YYYY HH24:MI') AS enviado_em
`;

// RF09: os avisos de arquivo novo. As tres funcoes abaixo nunca lancam erro,
// pelo mesmo motivo do notificar(): o aviso nao pode desfazer o envio. Por
// isso a consulta que descobre quem avisar tambem fica dentro do try.

// Material novo: avisa os alunos ativos da turma, ou o aluno destinatario.
// O OR no JOIN cobre os dois destinos numa consulta so: no material de turma,
// ar.aluno_id e nulo e valem as matriculas; no de aluno, vale o proprio aluno.
async function avisarMaterialNovo(arquivoId) {
  try {
    const resultado = await pool.query(`
      SELECT a.usuario_id AS destino, ue.nome AS remetente, ar.nome_original,
             t.nome AS turma_nome
      FROM arquivo ar
      JOIN usuario ue ON ue.id = ar.usuario_id
      LEFT JOIN turma t ON t.id = ar.turma_id
      JOIN aluno a ON a.id = ar.aluno_id
        OR a.id IN (SELECT m.aluno_id FROM matricula m WHERE m.turma_id = ar.turma_id)
      JOIN usuario ua ON ua.id = a.usuario_id AND ua.ativo = true
      WHERE ar.id = $1
    `, [arquivoId]);
    if (resultado.rows.length === 0) return;

    const { remetente, nome_original: nome, turma_nome: turma } = resultado.rows[0];
    const destino = turma ? `para a turma ${turma}` : 'para você';
    await notificar(
      resultado.rows.map((linha) => linha.destino),
      `${remetente} enviou o material "${nome}" ${destino}.`,
      arquivoId
    );
  } catch (e) {
    console.error('Falha ao avisar sobre material novo:', e.message);
  }
}

// Pratica nova: avisa os professores das turmas ativas do aluno. Sao os mesmos
// que podem ouvi-la (professorTemAluno): avisar quem nao pode abrir o arquivo
// seria um aviso sem saida. O admin nao e avisado - ele ouve todas as
// praticas da escola, e o aviso de cada uma viraria barulho.
async function avisarPraticaNova(arquivoId, alunoId) {
  try {
    const resultado = await pool.query(`
      SELECT DISTINCT p.usuario_id AS destino, ua.nome AS aluno_nome, ar.nome_original
      FROM arquivo ar
      JOIN aluno a ON a.id = $2
      JOIN usuario ua ON ua.id = a.usuario_id
      JOIN matricula m ON m.aluno_id = a.id
      JOIN turma t ON t.id = m.turma_id AND t.ativo = true AND t.status = 'ativa'
      JOIN professor p ON p.id = t.professor_id
      JOIN usuario up ON up.id = p.usuario_id AND up.ativo = true
      WHERE ar.id = $1
    `, [arquivoId, alunoId]);
    if (resultado.rows.length === 0) return;

    const { aluno_nome: aluno, nome_original: nome } = resultado.rows[0];
    await notificar(
      resultado.rows.map((linha) => linha.destino),
      `${aluno} enviou a gravação de prática "${nome}".`,
      arquivoId
    );
  } catch (e) {
    console.error('Falha ao avisar sobre prática nova:', e.message);
  }
}

// Primeiro acesso de um aluno a um material: grava o registro e avisa quem
// enviou. O ON CONFLICT DO NOTHING com RETURNING e o que faz o "so na primeira
// vez": se a dupla (arquivo, aluno) ja existe, o INSERT nao grava nada, nao
// devolve linha, e o professor nao e avisado de novo. Quem decide e o banco,
// pela chave primaria, e nao uma consulta antes do INSERT - assim dois cliques
// ao mesmo tempo nao geram dois avisos.
async function registrarDownload(arquivo, usuario) {
  try {
    const gravado = await pool.query(`
      INSERT INTO arquivo_download (arquivo_id, usuario_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING (SELECT nome FROM usuario WHERE id = $2) AS aluno_nome
    `, [arquivo.id, usuario.id]);
    if (gravado.rows.length === 0) return;

    await notificar(
      [arquivo.usuario_id],
      `${gravado.rows[0].aluno_nome} acessou o material "${arquivo.nome_original}".`,
      arquivo.id
    );
  } catch (e) {
    console.error('Falha ao registrar download:', e.message);
  }
}

// POST /api/arquivos/praticas -> o aluno logado envia um audio (RF08)
//
// Quando chega aqui, o multer (middlewares/upload.js) ja salvou o arquivo e o
// autorizar ja garantiu que o perfil e aluno.
async function enviarPratica(req, res) {
  try {
    // O token diz o usuario, mas a tabela arquivo aponta para aluno.id, que e
    // outro numero. E o filtro por ativo faz a exclusao valer aqui tambem: um
    // aluno excluido com token ainda valido nao consegue enviar.
    const aluno = await pool.query(`
      SELECT a.id
      FROM aluno a
      JOIN usuario u ON u.id = a.usuario_id
      WHERE a.usuario_id = $1 AND u.ativo = true
    `, [req.usuario.id]);

    if (aluno.rows.length === 0) {
      await apagarDoDisco(req.file.filename);
      return erro(res, 403, 'Não foi encontrado um cadastro de aluno ativo para este usuário');
    }

    const resultado = await pool.query(`
      INSERT INTO arquivo (usuario_id, aluno_id, tipo, caminho, nome_original)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      req.usuario.id,
      aluno.rows[0].id,
      req.file.tipoConferido,
      req.file.filename,
      req.file.originalname
    ]);

    const criado = await pool.query(
      `SELECT ${COLUNAS} FROM arquivo ar WHERE ar.id = $1`,
      [resultado.rows[0].id]
    );
    await avisarPraticaNova(resultado.rows[0].id, aluno.rows[0].id);
    res.status(201).json({ status: 'ok', dados: criado.rows[0] });
  } catch (e) {
    await apagarDoDisco(req.file.filename);
    erro(res, 500, 'Falha ao registrar o áudio enviado', e.message);
  }
}

// GET /api/arquivos/praticas -> audios de pratica de um aluno
//
// O aluno ve so os dele, e o aluno_id da URL e ignorado: se fosse respeitado,
// bastaria trocar o numero na URL para ouvir a pratica de um colega. Professor
// e administrador escolhem o aluno pelo ?aluno_id=.
async function listarPraticas(req, res) {
  let condicao;
  let parametros;

  if (req.usuario.perfil === 'aluno') {
    condicao = 'a.usuario_id = $1';
    parametros = [req.usuario.id];
  } else if (req.usuario.perfil === 'professor') {
    if (!idValido(req.query.aluno_id)) {
      return erro(res, 400, 'Informe o aluno em ?aluno_id=');
    }
    condicao = `
      a.id = $1
      AND EXISTS (
        SELECT 1
        FROM professor p
        JOIN usuario up ON up.id = p.usuario_id AND up.ativo = true
        JOIN turma t ON t.professor_id = p.id
          AND t.ativo = true AND t.status = 'ativa'
        JOIN matricula m ON m.turma_id = t.id AND m.aluno_id = a.id
        WHERE p.usuario_id = $2
      )`;
    parametros = [req.query.aluno_id, req.usuario.id];
  } else {
    if (!idValido(req.query.aluno_id)) {
      return erro(res, 400, 'Informe o aluno em ?aluno_id=');
    }
    condicao = 'a.id = $1';
    parametros = [req.query.aluno_id];
  }

  try {
    // ar.usuario_id = a.usuario_id e o que separa pratica de material do
    // professor (ver o comentario no topo do arquivo).
    const resultado = await pool.query(`
      SELECT ${COLUNAS}
      FROM arquivo ar
      JOIN aluno a ON a.id = ar.aluno_id
      WHERE ${condicao} AND ar.usuario_id = a.usuario_id
      ORDER BY ar.enviado_em DESC
    `, parametros);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao listar os áudios', e.message);
  }
}

// RF07: a turma que vai receber o material precisa estar ativa e, para o
// professor, ser dele. "Nao existe" e "nao e sua" caem na mesma consulta vazia
// e na mesma resposta - uma consulta so, e nada a descobrir testando numeros.
async function turmaPermitida(usuario, turmaId) {
  let doProfessor = '';
  const parametros = [turmaId];
  if (usuario.perfil === 'professor') {
    doProfessor = 'AND p.usuario_id = $2';
    parametros.push(usuario.id);
  }

  const resultado = await pool.query(`
    SELECT 1
    FROM turma t
    JOIN professor p ON p.id = t.professor_id
    JOIN usuario up ON up.id = p.usuario_id AND up.ativo = true
    WHERE t.id = $1 AND t.ativo = true AND t.status = 'ativa'
      ${doProfessor}
  `, parametros);
  return resultado.rows.length > 0;
}

// RF07: o aluno precisa estar ativo e, para o professor, matriculado numa
// turma ativa dele - a mesma regra que deixa o professor ouvir a pratica do
// aluno (professorTemAluno, mais abaixo). Quem pode ouvir pode mandar material.
async function alunoPermitido(usuario, alunoId) {
  const aluno = await pool.query(`
    SELECT a.usuario_id
    FROM aluno a
    JOIN usuario u ON u.id = a.usuario_id AND u.ativo = true
    WHERE a.id = $1
  `, [alunoId]);

  if (aluno.rows.length === 0) return false;
  if (usuario.perfil === 'admin') return true;
  return professorTemAluno(usuario.id, aluno.rows[0].usuario_id);
}

// POST /api/arquivos/materiais -> o professor envia um material (RF07)
//
// O formulario manda o arquivo e, junto, turma_id OU aluno_id. Quando chega
// aqui, o multer ja salvou o arquivo e ja leu esses campos para req.body: o
// destino so pode ser conferido depois de o arquivo estar no disco. Por isso
// toda recusa daqui para baixo apaga o que foi gravado.
async function enviarMaterial(req, res) {
  const recusar = async (status, message) => {
    await apagarDoDisco(req.file.filename);
    return erro(res, status, message);
  };

  // Campo vazio conta como nao enviado: um formulario com as duas listas manda
  // a que ficou sem escolha como texto vazio.
  const turmaId = req.body.turma_id || null;
  const alunoId = req.body.aluno_id || null;

  // Um destino e so um. Com os dois, o material apareceria para a turma inteira
  // E como pessoal de um aluno, e nao ficaria claro qual dos dois o professor
  // quis. Sem nenhum, o arquivo nao apareceria para ninguem.
  if ((turmaId && alunoId) || (!turmaId && !alunoId)) {
    return recusar(400, 'Informe a turma (turma_id) ou o aluno (aluno_id), um dos dois');
  }
  if (turmaId && !idValido(turmaId)) return recusar(400, 'Identificador de turma inválido');
  if (alunoId && !idValido(alunoId)) return recusar(400, 'Identificador de aluno inválido');

  try {
    if (turmaId && !(await turmaPermitida(req.usuario, turmaId))) {
      return recusar(404, 'Turma não encontrada');
    }
    if (alunoId && !(await alunoPermitido(req.usuario, alunoId))) {
      return recusar(404, 'Aluno não encontrado');
    }

    const resultado = await pool.query(`
      INSERT INTO arquivo (usuario_id, turma_id, aluno_id, tipo, caminho, nome_original)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      req.usuario.id,
      turmaId,
      alunoId,
      req.file.tipoConferido,
      req.file.filename,
      req.file.originalname
    ]);

    // turma_id e aluno_id voltam na resposta para a tela confirmar o destino.
    const criado = await pool.query(
      `SELECT ${COLUNAS}, ar.turma_id, ar.aluno_id FROM arquivo ar WHERE ar.id = $1`,
      [resultado.rows[0].id]
    );
    await avisarMaterialNovo(resultado.rows[0].id);
    res.status(201).json({ status: 'ok', dados: criado.rows[0] });
  } catch (e) {
    await apagarDoDisco(req.file.filename);
    erro(res, 500, 'Falha ao registrar o material enviado', e.message);
  }
}

// GET /api/arquivos/materiais -> materiais do professor (RF07)
//
// Cada perfil ve exatamente o que pode baixar em podeAcessar(), mais abaixo:
// o aluno, o que foi para as turmas dele e o que foi so para ele; o professor,
// o que ele enviou; o admin, todos os materiais.
//
// O aluno continua vendo o material de turma encerrada, como na agenda de
// aulas: o material ja foi entregue. Quem sai da turma perde a matricula, e
// com ela o acesso.
async function listarMateriais(req, res) {
  let condicao = 'true';
  const parametros = [];

  if (req.usuario.perfil === 'aluno') {
    condicao = `(
      ar.turma_id IN (
        SELECT m.turma_id
        FROM matricula m
        JOIN aluno al ON al.id = m.aluno_id
        WHERE al.usuario_id = $1
      )
      OR a.usuario_id = $1
    )`;
    parametros.push(req.usuario.id);
  } else if (req.usuario.perfil === 'professor') {
    condicao = 'ar.usuario_id = $1';
    parametros.push(req.usuario.id);
  }

  try {
    // O filtro contrario ao das praticas: material e o que OUTRA pessoa enviou.
    // IS DISTINCT FROM, e nao <>, porque no material de turma a.usuario_id e
    // nulo, e "x <> nulo" no SQL da nulo, nao verdadeiro - a linha sumiria.
    // Os nomes vem prontos para a tela mostrar "para a turma X, enviado por Y".
    // O enviado_por_id e o que diz a tela onde por o botao Excluir: o admin ve
    // todos os materiais, mas so apaga os dele, e o nome nao serve para isso -
    // duas pessoas podem ter o mesmo nome.
    const resultado = await pool.query(`
      SELECT ${COLUNAS},
             ar.turma_id,
             ar.aluno_id,
             t.nome AS turma_nome,
             ua.nome AS aluno_nome,
             ue.nome AS enviado_por,
             ar.usuario_id AS enviado_por_id
      FROM arquivo ar
      JOIN usuario ue ON ue.id = ar.usuario_id
      LEFT JOIN turma t ON t.id = ar.turma_id
      LEFT JOIN aluno a ON a.id = ar.aluno_id
      LEFT JOIN usuario ua ON ua.id = a.usuario_id
      WHERE ar.usuario_id IS DISTINCT FROM a.usuario_id
        AND ${condicao}
      ORDER BY ar.enviado_em DESC
    `, parametros);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    erro(res, 500, 'Falha ao listar os materiais', e.message);
  }
}

// Busca o arquivo junto com o usuario_id do aluno a que ele se refere, que e o
// que as regras de permissao abaixo precisam.
async function buscarArquivo(id) {
  const resultado = await pool.query(`
    SELECT ar.id, ar.usuario_id, ar.turma_id, ar.tipo, ar.caminho, ar.nome_original,
           a.usuario_id AS aluno_usuario_id
    FROM arquivo ar
    LEFT JOIN aluno a ON a.id = ar.aluno_id
    WHERE ar.id = $1
  `, [id]);
  return resultado.rows[0];
}

// Professor so acessa a pratica de aluno matriculado em uma turma ativa dele.
// O servidor repete a regra no download, pois esconder o aluno na tela nao e
// seguranca contra uma requisicao manual.
async function professorTemAluno(usuarioId, alunoUsuarioId) {
  const resultado = await pool.query(`
    SELECT 1
    FROM professor p
    JOIN usuario up ON up.id = p.usuario_id AND up.ativo = true
    JOIN turma t ON t.professor_id = p.id
      AND t.ativo = true AND t.status = 'ativa'
    JOIN matricula m ON m.turma_id = t.id
    JOIN aluno a ON a.id = m.aluno_id
    JOIN usuario ua ON ua.id = a.usuario_id AND ua.ativo = true
    WHERE p.usuario_id = $1 AND a.usuario_id = $2
    LIMIT 1
  `, [usuarioId, alunoUsuarioId]);
  return resultado.rows.length > 0;
}

// Sem olhar se a turma esta ativa: o aluno continua com o material de turma
// encerrada (ver listarMateriais).
async function alunoNaTurma(usuarioId, turmaId) {
  const resultado = await pool.query(`
    SELECT 1
    FROM matricula m
    JOIN aluno a ON a.id = m.aluno_id
    WHERE m.turma_id = $1 AND a.usuario_id = $2
  `, [turmaId, usuarioId]);
  return resultado.rows.length > 0;
}

// Quem pode ouvir ou baixar um arquivo. A regra fica numa funcao so para nao
// espalhar permissao pelo codigo, e bate com as listas: cada um baixa o que
// aparece na lista dele, e nada alem.
async function podeAcessar(usuario, arquivo) {
  if (usuario.perfil === 'admin') return true;
  if (arquivo.usuario_id === usuario.id) return true;       // quem enviou
  if (arquivo.aluno_usuario_id === usuario.id) return true; // o proprio aluno

  // O professor do aluno ouve a PRATICA dele, e so ela. O material que outro
  // professor mandou so para esse aluno fica entre os dois: ele nao aparece
  // na lista deste professor, e por isso tambem nao sai por aqui.
  const ehPratica = arquivo.aluno_usuario_id && arquivo.usuario_id === arquivo.aluno_usuario_id;
  if (usuario.perfil === 'professor' && ehPratica) {
    return professorTemAluno(usuario.id, arquivo.aluno_usuario_id);
  }

  if (usuario.perfil === 'aluno' && arquivo.turma_id) {
    return alunoNaTurma(usuario.id, arquivo.turma_id);
  }
  return false;
}

// GET /api/arquivos/:id -> entrega o conteudo do arquivo
//
// Esta rota e a UNICA forma de tirar um arquivo de backend/uploads/.
async function baixar(req, res) {
  if (!idValido(req.params.id)) return erro(res, 400, 'Identificador de arquivo inválido');

  try {
    const arquivo = await buscarArquivo(req.params.id);
    if (!arquivo || !(await podeAcessar(req.usuario, arquivo))) {
      return erro(res, 404, NAO_ENCONTRADO);
    }

    // RF09: so conta o aluno que abre material de OUTRA pessoa. A pratica dele
    // mesmo nao entra (ninguem precisa ser avisado de que o aluno ouviu a
    // propria gravacao), e o professor ou o admin abrindo um arquivo nao e o
    // "o aluno pegou o trabalho" que o registro existe para mostrar. Ouvir no
    // player da tela tambem conta: o player baixa o arquivo por esta rota.
    if (req.usuario.perfil === 'aluno' && arquivo.usuario_id !== req.usuario.id) {
      await registrarDownload(arquivo, req.usuario);
    }

    // res.download manda o arquivo com Content-Disposition: attachment, que e o
    // cabecalho que diz "salve com este nome" - o nome original, com acento e
    // tudo, sem que o nome aleatorio do disco apareca para ninguem.
    res.download(path.join(PASTA_UPLOADS, arquivo.caminho), arquivo.nome_original, {
      // O padrao do Express para arquivo e "Cache-Control: public", que autoriza
      // qualquer cache no caminho - inclusive um proxy da rede da escola, usado
      // por todo mundo - a guardar uma copia. Audio de aluno e privado.
      cacheControl: false,
      headers: {
        'Cache-Control': 'private, no-store',
        // O tipo vem do banco, onde foi gravado a partir da tabela do servidor.
        'Content-Type': arquivo.tipo,
        // Proibe o navegador de "adivinhar" o tipo olhando o conteudo. Os
        // atuais ja respeitam o Content-Type acima; alguns mais antigos,
        // farejando, abririam um HTML disfarcado de .mp3 como pagina e
        // rodariam o JavaScript de dentro. E a segunda trava.
        'X-Content-Type-Options': 'nosniff'
      }
    }, (e) => {
      // A linha existe no banco mas o arquivo sumiu do disco (alguem apagou a
      // pasta uploads/, por exemplo). Se o envio ja comecou, nao da mais para
      // mandar uma resposta de erro - o cabecalho ja saiu.
      if (e && !res.headersSent) {
        erro(res, 404, 'O arquivo não está mais no servidor');
      }
    });
  } catch (e) {
    erro(res, 500, 'Falha ao buscar o arquivo', e.message);
  }
}

// DELETE /api/arquivos/:id -> quem enviou apaga o proprio arquivo
//
// Aqui a exclusao e DE VERDADE, e nao logica como em aluno e professor. La, a
// exclusao logica existe porque matricula e frequencia apontam para o aluno, e
// apagar quebraria o historico. Aqui, as unicas tabelas que apontam para
// arquivo sao o registro de download e as notificacoes do RF09, e as duas sao
// apagadas junto (ON DELETE CASCADE, no schema.sql): nada fica orfao. E um
// audio enviado por engano nao e historico que valha guardar.
async function excluir(req, res) {
  if (!idValido(req.params.id)) return erro(res, 400, 'Identificador de arquivo inválido');

  try {
    const arquivo = await buscarArquivo(req.params.id);
    // So quem enviou. O professor que ouve a pratica nao a apaga.
    if (!arquivo || arquivo.usuario_id !== req.usuario.id) {
      return erro(res, 404, NAO_ENCONTRADO);
    }

    // Banco primeiro, disco depois. Se o disco falhar, sobra um arquivo sem
    // linha no banco: ocupa espaco, mas ninguem o ve. Na ordem inversa, se o
    // banco falhasse, sobraria uma linha na lista apontando para um arquivo que
    // nao existe mais - e o aluno clicaria num audio quebrado.
    await pool.query('DELETE FROM arquivo WHERE id = $1', [arquivo.id]);
    await apagarDoDisco(arquivo.caminho);

    // "Arquivo", e nao "Audio": desde o RF07 pode ser um PDF.
    res.json({ status: 'ok', message: 'Arquivo excluído' });
  } catch (e) {
    erro(res, 500, 'Falha ao excluir o arquivo', e.message);
  }
}

module.exports = { enviarPratica, listarPraticas, enviarMaterial, listarMateriais, baixar, excluir };
