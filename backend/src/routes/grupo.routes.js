// Rotas dos grupos extracurriculares. A participacao e opcional e nao altera
// as matriculas das turmas regulares.

const express = require('express');
const router = express.Router();
const grupoController = require('../controllers/grupo.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');

router.get('/', autenticar, autorizar('admin', 'professor', 'aluno'), grupoController.listar);
router.post('/', autenticar, autorizar('admin', 'professor'), grupoController.criar);
router.get('/:id/membros', autenticar, autorizar('admin', 'professor'), grupoController.listarMembros);
router.post('/:id/membros', autenticar, autorizar('admin', 'professor'), grupoController.adicionarMembro);
router.delete('/:id/membros/:alunoId', autenticar, autorizar('admin', 'professor'), grupoController.removerMembro);

module.exports = router;
