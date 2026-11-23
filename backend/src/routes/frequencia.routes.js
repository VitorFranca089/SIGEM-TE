// Rotas do RF05. Nasceram protegidas: a chamada e do admin e do professor, e
// o controller confirma que o professor e o da aula. O aluno so le a propria.

const express = require('express');
const router = express.Router();
const frequenciaController = require('../controllers/frequencia.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');

router.get('/eu', autenticar, autorizar('aluno'), frequenciaController.minhaFrequencia);
router.get('/aulas/:aulaId', autenticar, autorizar('admin', 'professor'), frequenciaController.verChamada);
router.put('/aulas/:aulaId', autenticar, autorizar('admin', 'professor'), frequenciaController.registrarChamada);

module.exports = router;
