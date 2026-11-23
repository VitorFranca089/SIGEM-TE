// Rotas de professores (RF02). Leitura exige sessao; toda escrita, inclusive o
// cadastro, exige perfil admin.
//
// O cadastro ja foi publico (22/09) e foi fechado em 23/09: todo professor lista
// os alunos e ouve as praticas de audio (RF08), entao uma conta de professor
// criada por qualquer pessoa, sem aprovacao, dava esse acesso a um estranho.

const express = require('express');
const router = express.Router();
const professorController = require('../controllers/professor.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');

router.get('/', autenticar, autorizar('admin', 'professor', 'aluno'), professorController.listar);
router.get('/:id', autenticar, autorizar('admin', 'professor', 'aluno'), professorController.buscarPorId);
router.post('/', autenticar, autorizar('admin'), professorController.criar);
router.put('/:id', autenticar, autorizar('admin'), professorController.atualizar);
router.delete('/:id', autenticar, autorizar('admin'), professorController.excluir);

module.exports = router;
