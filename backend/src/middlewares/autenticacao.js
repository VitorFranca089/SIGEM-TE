// Middlewares de autenticacao e autorizacao (RF06).
//
// Middleware e uma funcao que roda ANTES do controller e decide se a requisicao
// continua. Se chamar next(), a requisicao segue para a proxima funcao da fila;
// se responder com res.json(), a fila para ali e o controller nunca roda.
//
// Sao duas funcoes com responsabilidades diferentes de proposito:
//
//   autenticar -> "quem e voce?"    -> 401 quando nao da para saber
//   autorizar  -> "voce pode isso?" -> 403 quando da para saber, mas nao pode
//
// Separar as duas e o que permite escrever cada rota assim:
//
//   router.post('/', autenticar, autorizar('admin'), controller.criar);
//
// e ler a permissao da rota batendo o olho, sem abrir o controller.

const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function erro(res, status, message) {
  return res.status(status).json({ status: 'erro', message });
}

// Confere o token e descobre quem esta chamando.
//
// O token viaja no cabecalho HTTP "Authorization", no formato padrao
// "Bearer <token>" ("bearer" = portador: quem apresenta o token e tratado como
// dono dele). Nao vai na URL de proposito: URL entra no historico do navegador
// e nos logs do servidor, e o token e equivalente a uma senha.
async function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return erro(res, 401, 'E preciso estar autenticado para acessar isto');
  }

  try {
    // jwt.verify faz duas coisas numa chamada: confere a assinatura com o
    // JWT_SECRET (se alguem trocar um caractere do token, a conta nao fecha e
    // isto lanca excecao) e confere se o prazo de validade ja passou.
    const conteudo = jwt.verify(token, process.env.JWT_SECRET);

    // O JWT identifica a sessao, mas o perfil atual vem do banco. Assim uma
    // conta desativada ou alterada deixa de ter acesso antes do vencimento do
    // token, e o servidor nunca confia cegamente no perfil antigo do payload.
    const resultado = await pool.query(`
      SELECT id, perfil
      FROM usuario
      WHERE id = $1 AND ativo = true
    `, [conteudo.id]);
    if (resultado.rows.length === 0) {
      return erro(res, 401, 'Sessão expirada ou usuário inativo');
    }

    req.usuario = resultado.rows[0];
    next();
  } catch (e) {
    // Token adulterado e token vencido caem os dois aqui, com a mesma resposta:
    // do ponto de vista de quem chamou, os dois significam "faca login de novo".
    console.error('Falha ao autenticar requisicao:', e.message);
    return erro(res, 401, 'Sessão expirada ou token inválido');
  }
}

// Confere o perfil de quem ja foi identificado pelo autenticar.
//
// Repare que esta funcao NAO e um middleware: ela DEVOLVE um middleware. E o
// que permite escrever autorizar('admin', 'professor') com os perfis entre
// parenteses - os perfis sao lidos agora, na hora de montar a rota, e a funcao
// devolvida e que roda depois, a cada requisicao.
function autorizar(...perfisPermitidos) {
  return function (req, res, next) {
    // Rede de seguranca contra erro de programacao: se alguem escrever
    // autorizar() sem autenticar antes, a rota falha fechada (nega o acesso) em
    // vez de deixar passar sem conferir nada.
    if (!req.usuario) {
      return erro(res, 401, 'E preciso estar autenticado para acessar isto');
    }

    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      // 403 e nao 401: sabemos exatamente quem e, e a resposta continua sendo
      // nao. Mandar essa pessoa para a tela de login nao resolveria nada -
      // logar de novo devolveria o mesmo perfil.
      return erro(res, 403, 'Seu perfil não tem permissão para esta ação');
    }

    next();
  };
}

module.exports = { autenticar, autorizar };
