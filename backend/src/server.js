const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET precisa estar configurado antes de iniciar o servidor');
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('JWT_SECRET curto: use uma chave aleatoria com pelo menos 32 caracteres em producao.');
}

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const alunoRoutes = require('./routes/aluno.routes');
const professorRoutes = require('./routes/professor.routes');
const cursoRoutes = require('./routes/curso.routes');
const turmaRoutes = require('./routes/turma.routes');
const aulaRoutes = require('./routes/aula.routes');
const grupoRoutes = require('./routes/grupo.routes');
const pesquisaRoutes = require('./routes/pesquisa.routes');
const sistemaRoutes = require('./routes/sistema.routes');
const arquivoRoutes = require('./routes/arquivo.routes');
const frequenciaRoutes = require('./routes/frequencia.routes');
const notificacaoRoutes = require('./routes/notificacao.routes');

const app = express();

// Camada minima de protecao HTTP. O frontend e servido pelo mesmo host; CORS
// fica restrito a origens explicitamente configuradas, em vez de aceitar
// qualquer site externo.
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // media-src libera "blob:" porque a tela de Arquivos (RF08) nao pode tocar o
  // audio direto da API: o <audio> nao manda o token. Ela baixa o audio com
  // fetch e toca uma copia guardada na memoria do navegador, cujo endereco
  // comeca com "blob:". Sem isso, o player fica mudo sem mensagem nenhuma.
  // Imagem aceita qualquer endereco http/https por causa das capas das turmas:
  // a capa pode ser um link externo (as sugestoes vem do Pexels). Script
  // continua so do proprio servidor, que e o que protege contra XSS.
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  next();
});

const origensPermitidas = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origem, callback) => {
    if (!origem || origensPermitidas.includes(origem)) return callback(null, true);
    // Sem cabecalho CORS o navegador bloqueia a leitura por sites externos,
    // sem transformar a rejeicao em uma pagina de erro com detalhes internos.
    return callback(null, false);
  }
}));
app.use(express.json({ limit: '100kb' }));

// Serve o frontend direto pelo mesmo servidor: quem abrir http://localhost:3000
// ja recebe a tela, sem precisar abrir o index.html pelo disco separadamente.
// __dirname e o caminho absoluto da pasta deste arquivo (backend/src) - usamos
// ele, e nao um caminho relativo solto, porque um caminho relativo depende de
// qual pasta a pessoa estava quando digitou "npm run dev", e isso varia.
app.use(express.static(path.join(__dirname, '../../frontend')));
// As capas sao a unica parte de uploads/ servida sem token: uma foto de capa
// nao e dado pessoal, e a tag <img> nao manda o token. Materiais e praticas
// continuam saindo so pela rota /api/arquivos/:id, que confere quem pede.
app.use('/uploads/capas', express.static(path.join(__dirname, '../uploads/capas')));

// Rotas
// Registradas todas de uma vez no inicio do sprint: assim quem implementa alunos
// e quem implementa professores nunca precisa editar este arquivo ao mesmo tempo.
app.use('/api', healthRoutes);
app.use('/api', sistemaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/alunos', alunoRoutes);
app.use('/api/professores', professorRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/turmas', turmaRoutes);
app.use('/api/aulas', aulaRoutes);
app.use('/api/grupos', grupoRoutes);
app.use('/api/pesquisa', pesquisaRoutes);
app.use('/api/arquivos', arquivoRoutes);
app.use('/api/frequencia', frequenciaRoutes);
// Rotas novas entram ABAIXO desta linha. Este e o unico arquivo que as duas
// frentes de trabalho precisam editar - manter o acrescimo sempre no fim
// reduz a chance de dar conflito no Git.
app.use('/api/notificacoes', notificacaoRoutes);

// Erros de entrada malformada devem continuar sendo JSON e nunca devolver
// stack trace, nomes de arquivos ou detalhes do banco ao navegador.
app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'erro', message: 'JSON de requisicao inválido' });
  }
  console.error('Erro não tratado na API:', erro.message);
  return res.status(500).json({ status: 'erro', message: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor do SIGEM rodando em http://localhost:${PORT}`);
  console.log(`Teste em: http://localhost:${PORT}/api/health`);
});
