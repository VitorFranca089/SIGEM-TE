// Rotas de turmas, solicitacoes e matriculas (RF03).

const express = require('express');
const router = express.Router();
const turmaController = require('../controllers/turma.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');
const {
  criarUpload,
  TIPOS_DE_IMAGEM,
  TAMANHO_MAXIMO_IMAGEM_MB,
  PASTA_CAPAS
} = require('../middlewares/upload');

const uploadDeCapa = criarUpload({
  campo: 'imagem',
  tipos: TIPOS_DE_IMAGEM,
  tamanhoMaximoMb: TAMANHO_MAXIMO_IMAGEM_MB,
  pasta: PASTA_CAPAS,
  incluirExtensao: true
});

router.get('/', autenticar, autorizar('admin', 'professor'), turmaController.listar);
router.get('/minhas', autenticar, autorizar('aluno'), turmaController.listarDoAluno);
router.get('/:id', autenticar, autorizar('admin', 'professor'), turmaController.buscarPorId);
router.post('/', autenticar, autorizar('admin', 'professor'), turmaController.criar);
router.post('/:id/capa/arquivo', autenticar, autorizar('admin', 'professor'), uploadDeCapa, turmaController.enviarCapa);
router.patch('/:id/capa', autenticar, autorizar('admin', 'professor'), turmaController.atualizarCapa);
router.put('/:id', autenticar, autorizar('admin', 'professor'), turmaController.atualizar);
router.delete('/:id', autenticar, autorizar('admin'), turmaController.excluir);

router.get('/:id/alunos', autenticar, autorizar('admin', 'professor'), turmaController.listarAlunos);
// Matricular e desmatricular sao so do admin (decidido em 28/09). Desde que o
// professor passou a enxergar apenas os alunos das proprias turmas, ele nao
// tem de onde escolher um aluno novo; quem monta a turma e a secretaria.
router.post('/:id/alunos', autenticar, autorizar('admin'), turmaController.adicionarAluno);
router.delete('/:id/alunos/:alunoId', autenticar, autorizar('admin'), turmaController.removerAluno);

module.exports = router;
