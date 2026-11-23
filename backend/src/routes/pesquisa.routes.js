const express = require('express');
const router = express.Router();
const pesquisaController = require('../controllers/pesquisa.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');

router.get('/', autenticar, autorizar('admin', 'professor', 'aluno'), pesquisaController.listar);

module.exports = router;
