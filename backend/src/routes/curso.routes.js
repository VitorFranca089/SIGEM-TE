// Rotas do catalogo de cursos (RF03).

const express = require('express');
const router = express.Router();
const cursoController = require('../controllers/curso.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');

router.get('/', autenticar, autorizar('admin', 'professor', 'aluno'), cursoController.listar);
router.get('/:id', autenticar, autorizar('admin', 'professor', 'aluno'), cursoController.buscarPorId);
router.post('/', autenticar, autorizar('admin'), cursoController.criar);
router.put('/:id', autenticar, autorizar('admin'), cursoController.atualizar);
router.delete('/:id', autenticar, autorizar('admin'), cursoController.excluir);

module.exports = router;
