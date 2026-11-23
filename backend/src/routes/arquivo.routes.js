// Rotas de arquivos: praticas do aluno (RF08) e materiais do professor (RF07).
//
// Diferente de alunos e professores, estas rotas ja nascem protegidas: um
// arquivo enviado sem saber quem enviou nao teria dono, e um download sem saber
// quem pede nao teria como conferir permissao.
//
// A ordem dos middlewares importa: autenticar e autorizar vem ANTES do upload.
// Assim, quem nao tem o perfil da rota leva 403 antes de um unico byte ser
// gravado no disco.

const express = require('express');
const router = express.Router();
const arquivoController = require('../controllers/arquivo.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');
const {
  criarUpload,
  TIPOS_DE_AUDIO,
  TAMANHO_MAXIMO_AUDIO_MB,
  TIPOS_DE_MATERIAL,
  TAMANHO_MAXIMO_MATERIAL_MB
} = require('../middlewares/upload');

// O formulario da tela manda o arquivo no campo "audio".
const uploadDeAudio = criarUpload({
  campo: 'audio',
  tipos: TIPOS_DE_AUDIO,
  tamanhoMaximoMb: TAMANHO_MAXIMO_AUDIO_MB
});

// O do professor manda no campo "arquivo": o material pode ser PDF, e um campo
// chamado "audio" com um PDF dentro confundiria quem for ler a tela depois.
const uploadDeMaterial = criarUpload({
  campo: 'arquivo',
  tipos: TIPOS_DE_MATERIAL,
  tamanhoMaximoMb: TAMANHO_MAXIMO_MATERIAL_MB
});

// RF08: so o aluno envia pratica.
router.post('/praticas', autenticar, autorizar('aluno'), uploadDeAudio, arquivoController.enviarPratica);

// O aluno ve as proprias; professor e admin escolhem o aluno (?aluno_id=).
router.get('/praticas', autenticar, autorizar('aluno', 'professor', 'admin'), arquivoController.listarPraticas);

// RF07: o professor envia para uma turma ou um aluno. O admin tambem, para
// qualquer turma ou aluno ativo. Quais turmas e alunos cada um pode usar e
// conferido no controller, que precisa do banco para saber.
router.post('/materiais', autenticar, autorizar('professor', 'admin'), uploadDeMaterial, arquivoController.enviarMaterial);

// Os tres perfis listam; o que cada um ve e decidido no controller.
router.get('/materiais', autenticar, autorizar('aluno', 'professor', 'admin'), arquivoController.listarMateriais);

// Genericas, para qualquer arquivo. Ficam por ULTIMO: o Express testa as rotas
// na ordem em que foram escritas, e "/:id" aceita qualquer palavra. O
// GET /materiais, se viesse depois daqui, cairia no baixar, com id "materiais".
// Nao ha autorizar aqui porque a permissao depende do ARQUIVO, e nao so do
// perfil - quem decide e o controller (podeAcessar para ouvir, "quem enviou"
// para apagar).
router.get('/:id', autenticar, arquivoController.baixar);
router.delete('/:id', autenticar, arquivoController.excluir);

module.exports = router;
