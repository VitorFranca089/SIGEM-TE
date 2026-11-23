// Controller de autenticacao (RF06): login e consulta de quem esta logado.
//
// A tabela "usuario" e a unica consultada aqui, independente do perfil. E o que
// a separacao entre "usuario" e as tabelas satelite (aluno, professor) comprou:
// o login e uma consulta so, e nao uma busca em tres lugares.

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { enviarCodigoRecuperacao } = require('../utils/mailer');
const {
  validarEmail,
  validarSenha,
  validarConfirmacaoSenha
} = require('../utils/validacao');

// Quanto tempo o token vale antes de o usuario precisar entrar de novo.
// Oito horas = um dia de expediente da escola. Constante nomeada e nao um '8h'
// solto no meio da chamada, para o numero ter um lugar so onde muda.
const VALIDADE_TOKEN = '8h';

// Mensagem UNICA para os tres casos de falha no login: e-mail que nao existe,
// usuario inativo e senha errada. Dizer "esse e-mail nao esta cadastrado"
// transformaria a tela de login num verificador de contas - qualquer pessoa
// descobriria quais e-mails tem acesso ao sistema, testando um por um.
const FALHA_LOGIN = 'E-mail ou senha inválidos';
const minutosConfigurados = Number(process.env.RECUPERACAO_EXPIRA_MINUTOS || 15);
const MINUTOS_RECUPERACAO = Number.isFinite(minutosConfigurados) && minutosConfigurados > 0
  ? Math.min(minutosConfigurados, 60)
  : 15;

let tabelaRecuperacaoPronta;

async function garantirTabelaRecuperacao() {
  if (!tabelaRecuperacaoPronta) {
    tabelaRecuperacaoPronta = pool.query(`
      CREATE TABLE IF NOT EXISTS recuperacao_senha (
        id BIGSERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuario(id),
        codigo_hash CHAR(64) NOT NULL UNIQUE,
        expira_em TIMESTAMPTZ NOT NULL,
        usado_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS recuperacao_senha_usuario_idx
        ON recuperacao_senha (usuario_id, expira_em);
    `).catch((e) => {
      tabelaRecuperacaoPronta = null;
      throw e;
    });
  }
  await tabelaRecuperacaoPronta;
}

function hashCodigo(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex');
}

function erro(res, status, message, detalhe) {
  return res.status(status).json({ status: 'erro', message, detalhe });
}

// POST /api/auth/login -> confere e-mail e senha, devolve o token
async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return erro(res, 400, 'Informe o e-mail e a senha');
  }

  try {
    // O e-mail e normalizado do mesmo jeito que no cadastro (trim + minusculas),
    // senao quem se cadastrou como "Ana@Escola.com" nao conseguiria entrar
    // digitando "ana@escola.com".
    //
    // O filtro por ativo = true e o que faz a exclusao logica valer para o
    // login: um aluno excluido continua no banco, mas nao entra mais.
    const resultado = await pool.query(`
      SELECT id, nome, email, senha_hash, perfil
      FROM usuario
      WHERE email = $1 AND ativo = true
    `, [email.trim().toLowerCase()]);

    if (resultado.rows.length === 0) {
      return erro(res, 401, FALHA_LOGIN);
    }

    const usuario = resultado.rows[0];

    // bcrypt.compare refaz o hash da senha digitada com o mesmo sal guardado
    // dentro do hash do banco e compara os dois. O hash e irreversivel: nem o
    // sistema sabe qual e a senha, so sabe dizer se a digitada bate.
    const senhaConfere = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaConfere) {
      return erro(res, 401, FALHA_LOGIN);
    }

    // O token carrega o minimo necessario para decidir acesso: quem e (id) e o
    // que pode (perfil). Nome e e-mail ficam de fora porque nenhuma decisao
    // depende deles, e porque o conteudo de um JWT NAO e secreto - ele e apenas
    // assinado. Qualquer pessoa com o token le o que tem dentro; o que ela nao
    // consegue e alterar o conteudo sem invalidar a assinatura.
    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: VALIDADE_TOKEN }
    );

    res.json({
      status: 'ok',
      dados: {
        token,
        // Devolvido a parte para a tela montar o "Logado como ..." sem precisar
        // abrir o token. senha_hash nunca sai daqui.
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil
        }
      }
    });
  } catch (e) {
    console.error('Falha ao fazer login:', e.message);
    erro(res, 500, 'Falha ao fazer login');
  }
}

// POST /api/auth/recuperar -> gera e envia um codigo temporario.
async function solicitarRecuperacao(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return erro(res, 400, 'Informe o e-mail');
  const problemaEmail = validarEmail(email);
  if (problemaEmail) return erro(res, 400, problemaEmail);

  try {
    await garantirTabelaRecuperacao();
    const usuario = await pool.query(`
      SELECT id, nome, email
      FROM usuario
      WHERE email = $1 AND ativo = true
    `, [email]);

    // A mesma resposta para e-mail cadastrado e nao cadastrado evita revelar
    // quais enderecos possuem conta no SIGEM.
    const respostaGenerica = 'Se o e-mail estiver cadastrado, enviaremos um código de recuperação.';
    if (usuario.rows.length === 0) return res.json({ status: 'ok', message: respostaGenerica });

    const pessoa = usuario.rows[0];
    const codigo = String(crypto.randomInt(100000, 1000000));
    const codigoHash = hashCodigo(codigo);
    const expiraEm = new Date(Date.now() + MINUTOS_RECUPERACAO * 60 * 1000);

    await pool.query(
      'UPDATE recuperacao_senha SET usado_em = NOW() WHERE usuario_id = $1 AND usado_em IS NULL',
      [pessoa.id]
    );
    const token = await pool.query(`
      INSERT INTO recuperacao_senha (usuario_id, codigo_hash, expira_em)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [pessoa.id, codigoHash, expiraEm]);

    try {
      await enviarCodigoRecuperacao({
        email: pessoa.email,
        nome: pessoa.nome,
        codigo,
        minutos: MINUTOS_RECUPERACAO
      });
    } catch (e) {
      await pool.query('DELETE FROM recuperacao_senha WHERE id = $1', [token.rows[0].id]);
      console.error('Falha ao enviar código de recuperação:', e.message);
      // Nao diferenciar falha de envio de e-mail inexistente evita enumerar
      // contas. O detalhe fica somente no log do servidor para configuracao.
      return res.json({ status: 'ok', message: respostaGenerica });
    }

    return res.json({ status: 'ok', message: respostaGenerica });
  } catch (e) {
    console.error('Falha ao iniciar a recuperação de senha:', e.message);
    erro(res, 500, 'Falha ao iniciar a recuperação de senha');
  }
}

// POST /api/auth/redefinir-senha -> valida o codigo e troca a senha.
async function redefinirSenha(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const codigo = typeof req.body.codigo === 'string' ? req.body.codigo.trim() : '';
  const novaSenha = req.body.nova_senha;
  const confirmacao = req.body.confirmacao_senha;
  const problemas = [
    validarEmail(email),
    !codigo ? 'Informe o código recebido por e-mail' : null,
    validarSenha(novaSenha),
    validarConfirmacaoSenha(novaSenha, confirmacao)
  ].filter(Boolean);
  if (problemas.length > 0) return erro(res, 400, problemas[0], problemas.join(' | '));

  try {
    await garantirTabelaRecuperacao();
    const codigoHash = hashCodigo(codigo);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const recuperacao = await client.query(`
        SELECT r.id, u.id AS usuario_id
        FROM recuperacao_senha r
        JOIN usuario u ON u.id = r.usuario_id
        WHERE u.email = $1
          AND u.ativo = true
          AND r.codigo_hash = $2
          AND r.usado_em IS NULL
          AND r.expira_em > NOW()
        ORDER BY r.criado_em DESC
        LIMIT 1
      `, [email, codigoHash]);

      if (recuperacao.rows.length === 0) {
        await client.query('ROLLBACK');
        return erro(res, 400, 'Código inválido ou expirado');
      }

      const senhaHash = await bcrypt.hash(novaSenha, 10);
      await client.query(
        'UPDATE usuario SET senha_hash = $1 WHERE id = $2',
        [senhaHash, recuperacao.rows[0].usuario_id]
      );
      await client.query(
        'UPDATE recuperacao_senha SET usado_em = NOW() WHERE id = $1',
        [recuperacao.rows[0].id]
      );
      await client.query('COMMIT');
      res.json({ status: 'ok', message: 'Senha redefinida com sucesso.' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('Falha ao redefinir a senha:', e.message);
    erro(res, 500, 'Falha ao redefinir a senha');
  }
}

// GET /api/auth/eu -> dados de quem esta logado (protegida por autenticar)
//
// Poderia responder direto do token, sem tocar no banco, e seria mais rapido.
// Consulta o banco de proposito: o JWT e "sem estado", ou seja, depois de
// emitido ninguem consegue cancela-lo - se um usuario for excluido as 10h, o
// token que ele pegou as 9h continua matematicamente valido ate expirar.
// Reler a linha filtrando por ativo = true e o que faz a exclusao ter efeito
// imediato aqui.
async function eu(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT id, nome, email, perfil
      FROM usuario
      WHERE id = $1 AND ativo = true
    `, [req.usuario.id]);

    if (resultado.rows.length === 0) {
      return erro(res, 401, 'Este usuário não está mais ativo');
    }

    res.json({ status: 'ok', dados: resultado.rows[0] });
  } catch (e) {
    console.error('Falha ao buscar o usuário logado:', e.message);
    erro(res, 500, 'Falha ao buscar o usuário logado');
  }
}

// GET /api/auth/usuarios -> quem tem acesso ao sistema (so admin)
//
// E a unica visao que cruza os tres perfis num lugar so: quem administra o
// sistema precisa saber quem consegue entrar nele. As telas de aluno e de
// professor mostram dados academicos; esta mostra acesso.
async function listarUsuarios(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT id, nome, email, perfil
      FROM usuario
      WHERE ativo = true
      ORDER BY perfil, nome
    `);
    res.json({ status: 'ok', dados: resultado.rows });
  } catch (e) {
    console.error('Falha ao listar os usuários:', e.message);
    erro(res, 500, 'Falha ao listar os usuários');
  }
}

module.exports = {
  login,
  solicitarRecuperacao,
  redefinirSenha,
  eu,
  listarUsuarios
};
