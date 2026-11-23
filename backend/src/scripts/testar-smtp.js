require('dotenv').config();

const { verificarSMTP } = require('../utils/mailer');

verificarSMTP()
  .then(() => {
    console.log('SMTP configurado e acessivel.');
  })
  .catch((erro) => {
    console.error(`SMTP indisponivel: ${erro.codigo || erro.message}`);
    process.exitCode = 1;
  });
