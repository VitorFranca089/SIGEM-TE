// Cria o primeiro administrador do sistema (RF06).
//
// Por que este script existe: nao ha nenhum caminho pela interface que produza
// um usuario com perfil 'admin'. O cadastro de alunos grava 'aluno' fixo, o de
// professores grava 'professor'. Sem isto, o banco nasce sem ninguem capaz de
// administrar o sistema - e a primeira tela de login nao teria com quem entrar.
//
// Por que um script e nao uma rota: uma rota que cria administrador e uma porta
// a mais para defender, e teria que ficar aberta (quem chamaria ela, se ainda
// nao existe admin para autenticar?). Um script roda no terminal de quem ja tem
// acesso a maquina e ao banco - quem chega ate aqui ja podia fazer um INSERT
// a mao de qualquer jeito.
//
// Como rodar, a partir de backend/:
//   npm run criar-admin

const readline = require('readline');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = require('../config/db');
const { validarNome, validarEmail, validarSenha } = require('../utils/validacao');

// O mesmo custo usado no cadastro de alunos. Se um dia mudar, muda nos dois -
// nao ha problema em hashes antigos terem custo diferente, o bcrypt guarda o
// custo dentro do proprio hash.
const CUSTO_HASH = 10;

// Codigo do PostgreSQL para violacao de UNIQUE (o e-mail ja existe).
const EMAIL_DUPLICADO = '23505';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Le as respostas como uma sequencia de linhas, e nao com rl.question().
//
// O motivo e um bug real que apareceu no teste: com rl.question(), se a entrada
// acabar antes da ultima pergunta (o usuario aperta Ctrl+D, ou o script recebe
// entrada redirecionada de um arquivo), o readline fecha e o callback da
// pergunta pendente NUNCA e chamado. O script entao terminava calado, com
// codigo de saida 0 - dizendo "deu certo" sem ter criado nada.
//
// O iterador resolve isso porque avisa quando as linhas acabaram (done), e ai
// da para falhar de forma explicita.
const linhas = rl[Symbol.asyncIterator]();

async function perguntar(texto) {
  process.stdout.write(texto);
  const { value, done } = await linhas.next();
  if (done) {
    throw new Error('Entrada interrompida antes de todas as respostas.');
  }
  return value;
}

async function main() {
  console.log('\nCriacao do primeiro administrador do SIGEM');
  console.log('------------------------------------------\n');

  const nome = await perguntar('Nome do administrador: ');
  const email = await perguntar('E-mail: ');
  // A senha aparece na tela enquanto e digitada. Esconder exigiria mexer no
  // stream de saida do terminal, e este script roda uma vez por maquina, em
  // ambiente local - o custo de esconder nao se paga aqui.
  const senha = await perguntar('Senha (minimo de 8 caracteres): ');

  // As mesmas regras do cadastro de alunos, reaproveitadas de utils/validacao.js.
  // Um admin criado por aqui nao pode escapar das regras que valem para todo
  // mundo - se escapasse, o script viraria a porta dos fundos da validacao.
  const problemas = [validarNome(nome), validarEmail(email), validarSenha(senha)].filter(Boolean);
  if (problemas.length > 0) {
    console.error('\nNao foi possivel criar o administrador:');
    for (const problema of problemas) console.error('  - ' + problema);
    return 1;
  }

  const nomeLimpo = nome.trim();
  const emailLimpo = email.trim().toLowerCase();

  try {
    const senhaHash = await bcrypt.hash(senha, CUSTO_HASH);
    const resultado = await pool.query(`
      INSERT INTO usuario (nome, email, senha_hash, perfil)
      VALUES ($1, $2, $3, 'admin')
      RETURNING id
    `, [nomeLimpo, emailLimpo, senhaHash]);

    // Uma unica escrita, entao nao ha transacao aqui: o administrador vive so
    // em "usuario". Aluno e professor precisam de transacao porque tem uma
    // segunda linha numa tabela satelite; admin nao tem satelite nenhum.
    console.log(`\nAdministrador criado com id ${resultado.rows[0].id}.`);
    console.log(`Entre no sistema com: ${emailLimpo}\n`);
    return 0;
  } catch (e) {
    if (e.code === EMAIL_DUPLICADO) {
      console.error('\nJa existe um usuario com esse e-mail.\n');
      return 1;
    }
    console.error('\nFalha ao criar o administrador: ' + e.message + '\n');
    return 1;
  }
}

main()
  .then((codigo) => {
    rl.close();
    // pool.end() fecha as conexoes abertas com o PostgreSQL. Sem isto o processo
    // fica pendurado no terminal depois de imprimir o resultado, porque o Node
    // so encerra quando nao ha mais nada esperando.
    return pool.end().then(() => process.exit(codigo));
  })
  .catch((e) => {
    console.error('\nErro inesperado: ' + e.message + '\n');
    rl.close();
    pool.end().then(() => process.exit(1));
  });
