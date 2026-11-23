// Recebimento de arquivos enviados pelo navegador (RF08 e RF07).
//
// O express.json() so entende corpo em JSON. Um arquivo chega em outro formato,
// o multipart/form-data: o corpo vem cortado em pedacos separados por uma linha
// marcadora, cada pedaco com seu proprio cabecalho. Quem recorta esses pedacos
// e grava o arquivo no disco e o multer. Sem ele, req.body chegaria vazio.
//
// Este arquivo NAO sabe o que e uma pratica de aluno nem um material de
// professor. Ele so sabe receber UM arquivo de um conjunto de extensoes, ate um
// tamanho. Cada requisito monta o seu recebedor com criarUpload(), passando as
// proprias regras - o RF07 reaproveita tudo isto sem mexer aqui dentro.

const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');

// Fora da pasta frontend/ DE PROPOSITO. O server.js publica frontend/ inteira
// com express.static, sem pedir login: um audio salvo ali poderia ser baixado
// por qualquer pessoa que adivinhasse o endereco. Aqui, a unica saida e a rota
// de download, que confere quem esta pedindo.
const PASTA_UPLOADS = path.join(__dirname, '../../uploads');
const PASTA_CAPAS = path.join(PASTA_UPLOADS, 'capas');
fs.mkdirSync(PASTA_CAPAS, { recursive: true });

// RF08: formatos que um celular grava. A extensao decide se o arquivo entra, e
// o tipo gravado no banco (o MIME, etiqueta que diz ao navegador o que o
// arquivo e) vem DESTA tabela - nunca do que o navegador de quem enviou disse.
// O MIME enviado pelo navegador e tao falsificavel quanto a extensao, e varia
// entre navegadores (o Firefox no Linux manda "application/octet-stream" para
// .opus): conferir os dois recusaria arquivo legitimo sem ganhar seguranca.
const TIPOS_DE_AUDIO = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',   // Gravador do iPhone e a maioria dos Android
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',  // audio do WhatsApp: e OGG por dentro, so muda o nome
  '.wav': 'audio/wav'
};

const TIPOS_DE_IMAGEM = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

// 50 MB: cabe um WAV (sem compressao, ~10 MB por minuto) de uns 5 minutos, ou
// quase uma hora de MP3. Decisao do Daniel em 19/09/2026.
const TAMANHO_MAXIMO_AUDIO_MB = 50;
const TAMANHO_MAXIMO_IMAGEM_MB = 5;

// RF07: o professor manda gravacao de referencia (os mesmos audios do aluno) ou
// documento de texto - e documento e so PDF. Decisao do Daniel em 02/10/2026:
// PDF abre em qualquer celular sem instalar nada, e o Word e o MuseScore (para
// partitura) salvam em PDF. O Word (.docx) ficou de fora tambem por causa do
// banco: o MIME dele tem 71 letras e a coluna arquivo.tipo e VARCHAR(50). Sem
// migrar a coluna, o envio passaria por aqui e quebraria na hora de gravar.
const TIPOS_DE_MATERIAL = {
  ...TIPOS_DE_AUDIO,
  '.pdf': 'application/pdf'
};

// O mesmo limite do aluno, de proposito: uma regra so no sistema inteiro. O
// criarUpload aceita um limite por recebedor, e nao por formato, entao estes
// 50 MB valem tanto para o PDF quanto para o audio.
const TAMANHO_MAXIMO_MATERIAL_MB = TAMANHO_MAXIMO_AUDIO_MB;

function erro(res, status, message) {
  return res.status(status).json({ status: 'erro', message });
}

// Monta o middleware que recebe um arquivo so, no campo "campo" do formulario.
//
//   tipos: objeto { '.extensao': 'tipo/mime' } com o que e aceito
//   tamanhoMaximoMb: acima disso, o envio e interrompido no meio
//
// Depois dele, o controller encontra em req.file o arquivo ja salvo no disco,
// e em req.file.tipoConferido o MIME desta tabela.
function criarUpload({ campo, tipos, tamanhoMaximoMb, pasta = PASTA_UPLOADS, incluirExtensao = false }) {
  const recebedor = multer({
    // Com a pasta como texto, o multer cria a pasta sozinho se ela nao existir.
    // Sem a opcao "filename", ele da ao arquivo um nome aleatorio de 32
    // caracteres, sem extensao - e e isso que queremos: gravar com o nome que o
    // usuario mandou permitiria sobrescrever o arquivo de outra pessoa, ou
    // mandar um nome como "../../src/server.js". O nome original vai so para o
    // banco, para o download sair legivel.
    storage: multer.diskStorage({
      destination: pasta,
      filename(req, file, cb) {
        const extensao = incluirExtensao ? path.extname(file.originalname).toLowerCase() : '';
        cb(null, crypto.randomUUID() + extensao);
      }
    }),

    // O padrao do multer le o nome do arquivo como latin1, e um nome com acento
    // chegaria embaralhado no banco (cada letra acentuada vira duas letras
    // estranhas). Os navegadores mandam o nome em UTF-8.
    defParamCharset: 'utf8',

    // O limite e conferido ENQUANTO o arquivo chega, e nao depois: um arquivo
    // de 2 GB e cortado nos primeiros 50 MB, sem encher o disco antes de
    // ser recusado. files: 1 recusa quem tentar mandar varios de uma vez.
    limits: { fileSize: tamanhoMaximoMb * 1024 * 1024, files: 1 },

    fileFilter(req, file, cb) {
      const extensao = path.extname(file.originalname).toLowerCase();
      const tipo = tipos[extensao];
      if (!tipo) {
        const aceitas = Object.keys(tipos).join(', ');
        const recusa = new Error('Formato não aceito. Envie um arquivo ' + aceitas);
        recusa.code = 'FORMATO_NAO_ACEITO';
        return cb(recusa);
      }
      file.tipoConferido = tipo;
      cb(null, true);
    }
  }).single(campo);

  // Embrulha o multer para os erros dele sairem no formato do projeto
  // ({ status: 'erro', message }) e em portugues. Sem isto, um arquivo grande
  // demais viraria uma pagina HTML de erro do Express, que a tela nao sabe ler.
  // Quando ha erro, o multer ja apagou do disco o que tinha gravado pela metade.
  return function (req, res, next) {
    recebedor(req, res, (e) => {
      if (!e) {
        if (!req.file) return erro(res, 400, 'Nenhum arquivo foi enviado');
        return next();
      }
      if (e.code === 'FORMATO_NAO_ACEITO') return erro(res, 415, e.message);
      if (e.code === 'LIMIT_FILE_SIZE') {
        return erro(res, 413, 'O arquivo passa do limite de ' + tamanhoMaximoMb + ' MB');
      }
      if (e instanceof multer.MulterError) {
        // Campo com outro nome, mais de um arquivo, e afins: erro de quem montou
        // a requisicao, nao do servidor.
        return erro(res, 400, 'Envio inválido: mande um arquivo só, no campo "' + campo + '"');
      }
      // Qualquer outra coisa (disco cheio, pasta sem permissao) e falha do
      // servidor, e responde no mesmo formato em vez de cair no HTML do Express.
      erro(res, 500, 'Falha ao receber o arquivo');
    });
  };
}

module.exports = {
  criarUpload,
  PASTA_UPLOADS,
  PASTA_CAPAS,
  TIPOS_DE_AUDIO,
  TAMANHO_MAXIMO_AUDIO_MB,
  TIPOS_DE_MATERIAL,
  TAMANHO_MAXIMO_MATERIAL_MB,
  TIPOS_DE_IMAGEM,
  TAMANHO_MAXIMO_IMAGEM_MB
};
