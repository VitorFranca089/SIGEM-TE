// Rotas de alunos (RF01). Este arquivo so liga caminho a funcao - a logica toda
// mora no controller, para poder ser lida e testada sem passar por HTTP.

const express = require('express');
const router = express.Router();
const alunoController = require('../controllers/aluno.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');
const { limitarTentativas } = require('../middlewares/limite');

router.get('/', autenticar, autorizar('admin', 'professor'), alunoController.listar);
router.get('/eu', autenticar, autorizar('aluno'), alunoController.eu);
router.get('/:id', autenticar, autorizar('admin', 'professor'), alunoController.buscarPorId);
// Cadastro publico e intencional: a pessoa ainda nao possui token.
router.post('/', limitarTentativas({ nome: 'cadastro-aluno', janelaMs: 60 * 60 * 1000, maximo: 10 }), alunoController.criar);
router.put('/:id', autenticar, autorizar('admin'), alunoController.atualizar);
router.delete('/:id', autenticar, autorizar('admin'), alunoController.excluir);

module.exports = router;
