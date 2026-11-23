// Envio de mensagens de recuperacao por SMTP. As credenciais ficam somente no
// .env; nunca entram no repositorio nem na resposta da API.
const nodemailer = require('nodemailer');

let transportador;

function configurado() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.EMAIL_FROM
  );
}

function obterTransportador() {
  if (!configurado()) {
    const erro = new Error('SMTP não configurado');
    erro.codigo = 'SMTP_NAO_CONFIGURADO';
    throw erro;
  }
  if (!transportador) {
    transportador = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
  return transportador;
}

async function verificarSMTP() {
  const transportadorAtual = obterTransportador();
  await transportadorAtual.verify();
  return true;
}

async function enviarCodigoRecuperacao({ email, nome, codigo, minutos }) {
  const transportadorAtual = obterTransportador();
  return transportadorAtual.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Código para recuperar sua senha - SIGEM',
    text: [
      `Olá, ${nome}.`,
      '',
      `Seu código de recuperação do SIGEM e: ${codigo}`,
      `Ele expira em ${minutos} minutos e pode ser usado uma única vez.`,
      '',
      'Se você não solicitou esta alteração, ignore este e-mail.'
    ].join('\n'),
    html: `<p>Ola, ${nome}.</p><p>Seu codigo de recuperacao do SIGEM e:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${codigo}</p><p>Ele expira em ${minutos} minutos e pode ser usado uma unica vez.</p><p>Se voce nao solicitou esta alteracao, ignore este e-mail.</p>`
  });
}

async function enviarAvisoCancelamentoAula({ email, nome, aula, motivo }) {
  const transportadorAtual = obterTransportador();
  const destino = nome ? `${nome} <${email}>` : email;
  const ehGrupo = Boolean(aula.grupo_nome);
  const nomeDestino = ehGrupo ? aula.grupo_nome : aula.turma_nome;
  const assunto = ehGrupo
    ? `Reuniao cancelada - ${nomeDestino}`
    : `Aula cancelada - ${nomeDestino}`;
  const horario = `${aula.data} das ${aula.hora_inicio} as ${aula.hora_fim}`;
  const origem = ehGrupo
    ? `grupo extracurricular ${aula.grupo_nome}`
    : `turma ${aula.turma_nome}`;
  return transportadorAtual.sendMail({
    from: process.env.EMAIL_FROM,
    to: destino,
    subject: assunto,
    text: [
      `Olá, ${nome || 'usuario'}.`,
      '',
      `A aula da ${origem}, marcada para ${horario}, foi cancelada.`,
      motivo ? `Motivo informado: ${motivo}` : '',
      '',
      'Acesse o SIGEM para consultar a agenda atualizada.'
    ].filter(Boolean).join('\n')
  });
}

module.exports = {
  enviarCodigoRecuperacao,
  enviarAvisoCancelamentoAula,
  verificarSMTP
};
