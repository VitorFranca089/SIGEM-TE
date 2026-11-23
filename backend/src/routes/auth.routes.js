// Rotas de autenticacao (RF06).
//
// Este arquivo e o indice das permissoes do sistema: da para bater o olho e
// saber o que cada endereco exige, sem abrir o controller. Os middlewares rodam
// na ordem em que aparecem - autenticar descobre quem e, autorizar confere se
// pode, e so entao o controller roda.

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { autenticar, autorizar } = require('../middlewares/autenticacao');
const { limitarTentativas } = require('../middlewares/limite');

// Aberta por necessidade: e impossivel exigir token de quem esta pedindo um.
router.post('/login', limitarTentativas({ nome: 'login', janelaMs: 15 * 60 * 1000, maximo: 5, contarSoFalhas: true }), authController.login);
router.post('/recuperar', limitarTentativas({ nome: 'recuperar', janelaMs: 15 * 60 * 1000, maximo: 5 }), authController.solicitarRecuperacao);
router.post('/redefinir-senha', limitarTentativas({ nome: 'redefinir-senha', janelaMs: 15 * 60 * 1000, maximo: 10 }), authController.redefinirSenha);

// Exige token, mas serve a qualquer perfil - todo mundo pode ver os proprios dados.
router.get('/eu', autenticar, authController.eu);

// Exige token E perfil admin. Quem tem token de aluno recebe 403 aqui.
router.get('/usuarios', autenticar, autorizar('admin'), authController.listarUsuarios);

module.exports = router;
