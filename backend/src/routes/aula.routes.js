// Rotas do RF04. Toda agenda exige sessao; alteracoes ficam com admin e
// professores, e o controller confirma o vinculo do professor ao recurso.

const express = require('express');
const router = express.Router();
const aulaController = require('../controllers/aula.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');

router.get('/', autenticar, autorizar('admin', 'professor', 'aluno'), aulaController.listar);
router.post('/', autenticar, autorizar('admin', 'professor'), aulaController.criar);
router.put('/:id', autenticar, autorizar('admin', 'professor'), aulaController.atualizar);
router.patch('/:id/cancelar', autenticar, autorizar('admin', 'professor'), aulaController.cancelar);

module.exports = router;
