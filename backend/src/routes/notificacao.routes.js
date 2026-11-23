// Rotas de notificacoes (RF09).
//
// Sem autorizar(): os tres perfis recebem notificacoes, e cada um so alcanca
// as proprias, porque o controller filtra pelo usuario do token.

const express = require('express');
const router = express.Router();
const notificacaoController = require('../controllers/notificacao.controller');
const { autenticar } = require('../middlewares/autenticacao');

router.get('/', autenticar, notificacaoController.listar);
router.patch('/lidas', autenticar, notificacaoController.marcarLidas);

module.exports = router;
