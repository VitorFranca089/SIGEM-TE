# Arquitetura do SIGEM

Sistema web de gestão para escolas de música. TCC de Anita Felício dos Santos e
Daniel Carrapeiro Mendes — Fatec Ourinhos, ADS.

Estado atual (22/10/2026, versão `0.11.0`): os nove requisitos estão
implementados. Os oito do MVP do TCC (RF01 a RF08) estão na `main` desde a
`0.10.0`; o RF09 (notificações e registro de download), pedido pelo orientador
no feedback de 22/10, está na branch `independente/notificacoes`. As rotas de
dados exigem token e perfil; permanecem públicas apenas o cadastro de aluno,
login, recuperação de senha, versão e changelog.

## Arquivos, na ordem em que o código executa

| Arquivo | O que faz | Quem chama |
|---|---|---|
| `frontend/index.html` | Página inicial: menu de navegação e o cartão de diagnóstico do ambiente. | O navegador, servido pelo próprio backend em `http://localhost:3000/`. |
| `frontend/alunos.html` | Tela de alunos: formulário que serve para cadastrar e editar, e tabela da listagem. | O navegador, pelo menu. |
| `frontend/professores.html` | Tela de professores, no mesmo formato da de alunos, com confirmação de senha e campo de especialidades em texto livre. | O navegador, pelo menu. |
| `frontend/js/professores.js` | Chama a API de professores; formata o CPF com pontuação enquanto a pessoa digita, mas envia e recebe o valor que o backend decide. | `professores.html`. |
| `frontend/cursos.html` | Tela do catalogo de cursos; alteracoes ficam disponiveis somente para o administrador. | O navegador, pelo menu. |
| `frontend/js/cursos.js` | Lista cursos para admin e professor e executa o CRUD administrativo. | `cursos.html`. |
| `frontend/turmas.html` | Tela de criacao/aprovacao de turmas e gerenciamento de alunos matriculados. | O navegador, pelo menu. |
| `frontend/js/turmas.js` | Consulta cursos, professores e alunos; envia solicitacoes e administra horarios. Matricular e remover aluno só aparecem para o admin; para o professor, a lista da turma é só leitura. Também edita a capa da turma (link ou imagem enviada, com posição e zoom e uma prévia). | `turmas.html`. |
| `frontend/arquivos.html` | Tela de arquivos dos três perfis: em cima, o material do professor (RF07: professor e admin enviam, todos veem); embaixo, as gravações de prática (RF08). | O navegador, pelo menu. |
| `frontend/notificacoes.html` e `js/notificacoes.js` | Lista as notificações de quem está logado (RF09), com as novas destacadas, e só depois de mostrar marca todas como lidas (`PATCH /api/notificacoes/lidas`). | O navegador, pelo link "Notificações" da seção Gestão (os três perfis). |
| `frontend/js/arquivos.js` | Mostra só os blocos do perfil logado; busca cada arquivo com `fetch` levando o token e entrega ao player ou ao download como *blob*, porque um `<audio src>` não manda o cabeçalho `Authorization`. | `arquivos.html`. |
| `frontend/cadastro.html` | Tela pública de entrada do cadastro; explica que só aluno se cadastra sozinho e leva ao formulário. | O navegador, pelo botão "Novo aluno" do `index.html`. |
| `frontend/cadastro-aluno.html` | Formulário público de autocadastro de aluno. | `cadastro.html`. |
| `frontend/js/cadastro.js` | Envia o autocadastro para `POST /api/alunos`. Professor não se cadastra sozinho. | `cadastro-aluno.html`. |
| `frontend/js/senha-ui.js` | Aviso de Caps Lock e lista visual dos requisitos da senha, em todo campo de senha da tela. | `cadastro-aluno.html` e `redefinir-senha.html`. |
| `frontend/recuperar-senha.html` e `js/recuperar.js` | Pede o código de recuperação por e-mail (`POST /api/auth/recuperar`). | O navegador, pelo link da tela de login. |
| `frontend/redefinir-senha.html` e `js/redefinir.js` | Troca a senha usando o código recebido (`POST /api/auth/redefinir-senha`). | O navegador, depois de receber o código. |
| `frontend/js/capas.js` | Guarda os links das capas de demonstração (fotos do Pexels) e `aplicarCapa()`, que pinta o fundo dos elementos marcados com `data-capa`. Expõe `window.CAPAS_PEXELS` para a turma sem capa própria ganhar uma pelo nome do curso. | `classes.html`, antes do script da tela. |
| `frontend/classes.html` e `js/classes.js` | Lista as turmas em que o aluno logado está matriculado (`GET /api/turmas/minhas`) e, embaixo, a seção Minhas presenças (RF05), com cada aula que teve chamada e a contagem de presenças e faltas (`GET /api/frequencia/eu`). Cada turma mostra a capa dela, com a posição e o zoom gravados. | O navegador, pela barra lateral. |
| `frontend/contatos.html` e `js/contatos.js` | Lista nome e e-mail dos professores (`GET /api/professores`). | O navegador, pela barra lateral. |
| `frontend/pesquisa.html` e `js/pesquisa.js` | Busca com filtro por tipo, em `GET /api/pesquisa`: os resultados são os cursos, turmas, grupos e professores ativos do banco. | O navegador, pela barra lateral. |
| `frontend/grupos.html` | Página de apresentação dos grupos, com texto fixo; quem cria grupos de verdade é a tela de agenda. | O navegador, pela barra lateral. |
| `frontend/conta.html` e `js/conta.js` | Mostra nome, e-mail e perfil de quem está logado, com o botão de sair. | O navegador, pela barra lateral ("Sua conta"). |
| `frontend/js/alunos.js` | Chama a API de alunos e monta a tabela; monta as células com `textContent` para não executar HTML vindo do banco. | `alunos.html`. |
| `frontend/css/style.css` | Estilo de **todas** as telas. Classes genéricas (`.cartao`, `.campo`, `.tabela-wrapper`, `.mensagem`) para que ninguém precise escrever CSS solto por tela. | Todas as páginas, via `<link>`. |
| `frontend/js/main.js` | Faz `fetch` na API e escreve o resultado na tela; a URL do backend está fixa na constante `API_URL`. | `index.html`, via `<script>`. |
| `backend/package.json` | Declara as dependências e os scripts `dev` (nodemon) e `start`. | O `npm`. |
| `backend/.env.example` | Modelo das variáveis de ambiente, sem valores reais. | Copiado à mão para `.env`. |
| `backend/src/server.js` | Cria o app Express, liga `cors` e `express.json`, **serve a pasta `frontend/` como arquivos estáticos**, registra os routers sob `/api` e sobe o servidor na porta do `.env`. Serve também `uploads/capas/` sem token (a única parte de `uploads/` assim). | `npm run dev` / `npm start`. |
| `backend/src/routes/health.routes.js` | Duas rotas de diagnóstico: `/api/health` (API viva) e `/api/health/db` (banco responde). | `server.js`, via `app.use('/api', ...)`. |
| `backend/src/routes/auth.routes.js` | Liga login, sessão, perfis, recuperação e redefinição de senha (RF06). É o índice das permissões: dá para ver o que cada rota exige sem abrir o controller. | `server.js`. |
| `backend/src/middlewares/autenticacao.js` | `autenticar` confere o token e descobre quem chamou (401 quando não dá); `autorizar('admin', ...)` confere se o perfil pode (403 quando não). | Os arquivos de rota, antes do controller. |
| `backend/src/controllers/auth.controller.js` | Login, sessão, perfis, recuperação por código temporário e troca segura de senha. | `auth.routes.js`. |
| `backend/src/scripts/criar-admin.js` | Cria o primeiro administrador pelo terminal. Existe porque nenhuma tela produz perfil `admin`. Não é chamado pelo servidor. | `npm run criar-admin`, à mão. |
| `backend/src/scripts/testar-smtp.js` | Tenta conectar ao servidor de e-mail do `.env` e diz se ele está acessível, sem mandar e-mail nenhum. Não é chamado pelo servidor. | `npm run testar-smtp`, à mão. |
| `backend/src/scripts/dados-demo.js` | Preenche um banco vazio com a escola da banca (as pessoas das capturas do TCC, três semanas de aulas, chamadas, arquivos e notificações), com a aula de hoje já começada. Recusa banco que já tenha escola. | `DB_NAME=sigem_banca npm run dados-demo`, à mão. |
| `backend/src/routes/aluno.routes.js` | Liga os caminhos de `/api/alunos` com autenticação por perfil e cadastro inicial limitado. | `server.js`. |
| `backend/src/controllers/aluno.controller.js` | CRUD de alunos (RF01): grava em `usuario` + `aluno` numa transação, faz o hash da senha e exclui de forma lógica. Para o professor, lista e busca só os alunos matriculados nas turmas ativas dele. | `aluno.routes.js`. |
| `backend/src/routes/professor.routes.js` | Liga os caminhos de `/api/professores` com leitura autenticada, escrita administrativa e cadastro inicial limitado. | `server.js`. |
| `backend/src/controllers/professor.controller.js` | CRUD de professores (RF02): grava em `usuario` + `professor` numa transação, com perfil `professor`, e grava o CPF só com os dígitos. | `professor.routes.js`. |
| `backend/src/routes/curso.routes.js` | Rotas protegidas do catalogo de cursos; escrita restrita ao administrador. | `server.js`. |
| `backend/src/controllers/curso.controller.js` | CRUD de cursos com exclusao logica e bloqueio de dados inativos. | `curso.routes.js`. |
| `backend/src/routes/turma.routes.js` | Rotas protegidas de turmas, solicitacoes e matriculas. Matricular e desmatricular exigem o perfil `admin`. Monta o recebedor de imagem da capa (`POST /:id/capa/arquivo`) e liga `PATCH /:id/capa`. | `server.js`. |
| `backend/src/controllers/turma.controller.js` | Vincula curso, professor, horario e alunos; aplica fluxo solicitada/ativa/recusada/encerrada e evita conflito de horario. Grava a capa (link http/https ou imagem enviada) só para o admin ou o professor da turma, e apaga do disco a imagem que a nova substituiu. | `turma.routes.js`. |
| `backend/src/routes/aula.routes.js` | Lista, agenda, edita e cancela ocorrencias concretas de aulas. | `server.js`. |
| `backend/src/controllers/aula.controller.js` | Aplica permissao por professor/turma/grupo, conflitos de professor e aluno, cancelamento com seis horas e avisos por e-mail. | `aula.routes.js`. |
| `backend/src/routes/grupo.routes.js` | Lista grupos opcionais, cria grupos e administra participantes extracurriculares. | `server.js`. |
| `backend/src/controllers/grupo.controller.js` | Mantem grupos e membros sem misturar participacao extracurricular com matricula de turma. | `grupo.routes.js`. |
| `backend/src/routes/pesquisa.routes.js` | Liga `GET /api/pesquisa` para os três perfis logados. | `server.js`. |
| `backend/src/controllers/pesquisa.controller.js` | Junta numa consulta só cursos, turmas, grupos e professores ativos e filtra pelo termo e pela categoria, sempre por parâmetro (`$1`, `$2`), nunca colando o texto digitado no SQL. | `pesquisa.routes.js`. |
| `backend/src/routes/frequencia.routes.js` | Liga `/api/frequencia` (RF05): ver e salvar a chamada de uma aula (admin e professor) e `/eu`, em que o aluno vê as próprias presenças. | `server.js`. |
| `backend/src/controllers/frequencia.controller.js` | Monta a lista da chamada a partir da matrícula, grava presença e falta numa transação que também marca a aula como `realizada`, e recusa aula de grupo, cancelada ou que ainda não começou. | `frequencia.routes.js`. |
| `backend/src/routes/arquivo.routes.js` | Liga `/api/arquivos`: enviar e listar práticas (RF08), enviar e listar material (RF07), baixar e apagar um arquivo. Todas exigem token, e o upload só roda depois do `autorizar`. | `server.js`. |
| `backend/src/middlewares/upload.js` | `criarUpload()` monta, com o multer, um recebedor de **um** arquivo por lista de extensões e tamanho máximo, e traduz os erros dele para o JSON do projeto. Guarda as regras de formato e tamanho do RF08 (áudio), do RF07 (áudio e PDF) e das capas (imagem de até 5 MB, que vai para `uploads/capas/` com a extensão no nome). | `arquivo.routes.js`, que monta um recebedor para cada requisito. |
| `backend/src/controllers/arquivo.controller.js` | Grava a prática e o material do professor (conferindo se a turma ou o aluno de destino é dele), lista, entrega o arquivo e apaga. `podeAcessar()` concentra quem pode baixar o quê e bate com as listas — o professor ouve só a prática dos alunos das turmas ativas dele; o aluno baixa o material das turmas em que está matriculado. Também dispara os avisos do RF09: material novo para os alunos, prática nova para os professores do aluno, e o primeiro acesso de cada aluno a um material para quem enviou. | `arquivo.routes.js`. |
| `backend/src/utils/notificacoes.js` | `notificar()` grava a mesma mensagem para vários usuários numa consulta só e nunca lança erro: o aviso não pode desfazer o envio ou o download que o causou. | `arquivo.controller.js`. |
| `backend/src/routes/notificacao.routes.js` | Liga `/api/notificacoes`: listar e marcar como lidas, para os três perfis, sempre as do próprio usuário do token. | `server.js`. |
| `backend/src/controllers/notificacao.controller.js` | Devolve as 30 notificações mais recentes e a contagem de não lidas (que pode passar de 30), e marca todas como lidas. | `notificacao.routes.js`. |
| `backend/uploads/` | Pasta dos arquivos enviados, com nomes aleatórios. Fora do Git e fora do `express.static`: só sai pela rota de download. A exceção é a subpasta `capas/`, servida direto (ver Decisões). | Criada pelo multer no primeiro envio. |
| `backend/src/middlewares/limite.js` | Conta tentativas por IP numa janela de tempo e responde 429 quando passam do limite; no login, só as tentativas erradas contam. | `auth.routes.js` e `aluno.routes.js`. |
| `backend/src/utils/validacao.js` | Regras de validação compartilhadas por todos os cadastros: nome, e-mail, senha, data, e — para professor — confirmação de senha, telefone, CPF com dígito verificador e especialidades. | Os controllers e o `criar-admin.js`. |
| `backend/src/utils/mailer.js` | Monta o envio de e-mail (código de recuperação de senha e aviso de aula cancelada) a partir do SMTP do `.env`, com acesso a arquivo e URL externos desligado no envio. | `auth.controller.js`, `aula.controller.js` e `testar-smtp.js`. |
| `backend/src/config/db.js` | Cria o pool de conexões do PostgreSQL a partir do `.env` e exporta ele pronto para uso. | Todos os controllers, o `health.routes.js` e o `criar-admin.js`. |
| `backend/src/config/schema.sql` | Script de criação das tabelas, para banco novo. Inclui estado de cursos/turmas e solicitante. Só `CREATE`, nunca `DROP`. | Ninguém, no código. Rodado à mão com `psql -f`. |
| `backend/src/config/migration_professor.sql` | Leva a tabela `professor` de um banco criado antes do RF02 ao formato do `schema.sql` atual, numa transação que pode ser repetida. | Ninguém, no código. Rodado à mão, uma vez por banco antigo. |
| `backend/src/config/migration_recuperacao_senha.sql` | Cria a tabela `recuperacao_senha` (código com hash, validade e uso único) em bancos existentes. | Ninguém, no código. Rodado à mão, uma vez por banco antigo. |
| `backend/src/config/migration_rf03.sql` | Acrescenta estado, status, solicitante e indices necessários ao RF03 em bancos existentes. | Ninguém, no código. Rodado à mão, uma vez por banco antigo. |
| `backend/src/config/migration_rf04.sql` | Acrescenta grupos opcionais, participantes, status e cancelamento de aulas a bancos existentes. | Ninguém, no código. Rodado à mão, uma vez por banco antigo. |
| `backend/src/config/migration_notificacao.sql` | Cria `arquivo_download` e `notificacao` (RF09) em bancos existentes, numa transação que pode ser repetida. | Ninguém, no código. Rodado à mão, uma vez por banco antigo. |
| `backend/src/config/migration_capas_turma.sql` | Acrescenta à `turma` o link da capa, a posição horizontal e vertical (0 a 100) e o zoom (1 a 3) em bancos existentes. | Ninguém, no código. Rodado à mão, uma vez por banco antigo. |
| `backend/src/routes/sistema.routes.js` | `/api/versao` (lê `package.json`) e `/api/changelog` (lê `CHANGELOG.md`). Não pertence a nenhuma funcionalidade — é sobre o sistema em si. | `server.js`. |
| `frontend/login.html` | Tela de entrada: e-mail e senha. Marca o `<body>` com `data-tela-login` para o `sessao.js` não desenhar a barra "Entrar" dentro da própria tela de entrar. | O navegador. |
| `frontend/js/login.js` | Manda e-mail e senha para `/api/auth/login`, guarda a resposta pelo `Sessao` e redireciona para a página inicial. | `login.html`. |
| `frontend/agenda.html` | Agenda de turmas e grupos, com filtros, criação, edição e cancelamento. | O navegador, pelo menu. |
| `frontend/js/agenda.js` | Consulta a agenda, gerencia grupos opcionais e envia as ações protegidas do RF04. | `agenda.html`. |
| `frontend/chamada.html` | Tela de chamada (RF05): em cima, as aulas de turma de uma data até hoje; embaixo, os alunos da aula escolhida, com presença ou falta. | O navegador, pelo link "Chamada" da seção Gestão (só admin e professor). |
| `frontend/js/chamada.js` | Pede as aulas à mesma rota da Agenda (`GET /api/aulas`), com a data inicial 7 dias atrás, e filtra as de turma não canceladas; abre e salva a chamada em `/api/frequencia/aulas/:aulaId`, e só deixa salvar quando a API responde `chamada_aberta`. | `chamada.html`. |
| `frontend/js/sessao.js` | Guarda token e usuário no `sessionStorage`, desenha a barra "Logado como ...", aplica modo noturno e alto contraste, e acrescenta à barra lateral a seção "Gestão" com os links do perfil logado, com o contador de notificações não lidas ao lado do link "Notificações". Expõe um único global, `window.Sessao`; o `Sessao.cabecalho()` manda o token em todo `fetch`. | Todas as telas, via `<script>`. |
| `frontend/js/rodape.js` | Monta o rodapé com a versão no pé da barra lateral de toda tela que o incluir, e o diálogo do changelog. Interpreta o pouco de markdown que o `CHANGELOG.md` usa, sem biblioteca. | Todas as telas, via `<script>`. |
| `CHANGELOG.md` | Histórico de versões, mais recente primeiro, formato Keep a Changelog. | `sistema.routes.js`, que lê o arquivo cru. |


## Como as peças se conectam

O usuário abre `http://localhost:3000/` no navegador. O próprio backend entrega o
HTML: `express.static` serve a pasta `frontend/` inteira, então qualquer arquivo
dentro dela responde por HTTP sem precisar de rota escrita à mão. Não há build —
o HTML carrega o CSS e o `main.js` como arquivos comuns. Ao clicar no botão, o
`main.js` dispara um `fetch` para `/api/health/db` — endereço relativo, que o
navegador completa com o endereço da própria página.

Do outro lado, `server.js` já está rodando. Ele passa a requisição por dois
middlewares (funções que rodam antes da rota): o `cors`, que autoriza o navegador a
chamar um endereço diferente do da página, e o `express.json`, que transforma corpo
de requisição JSON em objeto JavaScript. Depois, o Express procura qual router
responde pelo caminho — tudo que começa com `/api` cai no `health.routes.js`.

A rota `/health/db` pega o pool exportado por `db.js` e roda um `SELECT NOW()`. O
pool (um conjunto de conexões abertas e reaproveitadas) já foi criado quando o
servidor subiu, então a consulta não precisa abrir conexão nova. O resultado volta
como JSON, o `main.js` lê o campo `status` e pinta o texto de verde ou vermelho.

Nas funcionalidades reais há uma camada a mais: o router não consulta o banco
direto, chama um controller em `controllers/`, e o controller é que usa o pool.

**O caminho de uma requisição autenticada tem ainda outra camada, antes do
controller.** Na tela de login, `js/login.js` manda e-mail e senha para
`/api/auth/login`. O controller busca a linha em `usuario` (filtrando por
`ativo = true`), usa `bcrypt.compare` para conferir a senha contra o
`senha_hash` e, dando certo, assina com o `JWT_SECRET` um token que carrega
apenas `id` e `perfil`. O `sessao.js` guarda esse token no `sessionStorage` do
navegador e desenha a barra "Logado como ..." no cabeçalho.

Da próxima vez, o token viaja no cabeçalho HTTP `Authorization: Bearer <token>`.
No servidor, os middlewares de `middlewares/autenticacao.js` rodam **antes** do
controller: `autenticar` confere a assinatura e o prazo do token e guarda quem é
em `req.usuario`; `autorizar` compara `req.usuario.perfil` com a lista de perfis
que aquela rota aceita. Qualquer um dos dois pode encerrar a requisição ali
mesmo — com 401 se não deu para saber quem é, com 403 se deu e a resposta ainda
é não. Só se os dois chamarem `next()` o controller chega a rodar.

**O envio de um arquivo (RF08) atravessa uma peça a mais.** Na tela de
arquivos, o `arquivos.js` monta um `FormData` com o áudio e o envia para
`POST /api/arquivos/praticas` — em `multipart/form-data`, não JSON. No servidor,
`autenticar` e `autorizar('aluno')` rodam primeiro; só então o recebedor
montado por `middlewares/upload.js` confere a extensão, corta o envio que passa
de 50 MB e grava o arquivo em `backend/uploads/` com nome aleatório. O
controller descobre o `aluno.id` de quem está logado e insere a linha em
`arquivo`; se o banco falhar, apaga o arquivo do disco. Para ouvir, o caminho é
o inverso: `GET /api/arquivos/:id` confere a permissão, e o `res.download`
entrega o arquivo com o nome original.

O material do professor (RF07) faz o mesmo caminho por
`POST /api/arquivos/materiais`, com uma volta a mais. Na tela, o professor
marca "Uma turma" ou "Um aluno", e o `arquivos.js` põe no `FormData`, junto
com o arquivo, só o campo do destino marcado. Esse destino (`turma_id` ou
`aluno_id`) chega no mesmo formulário que o arquivo, então o controller só
consegue conferi-lo depois de o multer ter gravado tudo. Cada recusa dali em
diante apaga o arquivo do disco antes de responder. Quem recebe pede
`GET /api/arquivos/materiais`, que devolve só o que aquele perfil pode baixar,
e baixa pela mesma `GET /api/arquivos/:id`.

**Salvar uma chamada (RF05) é a única escrita que mexe em duas tabelas de uma
vez.** O professor manda `PUT /api/frequencia/aulas/:aulaId` com a lista de
presenças. Antes de tocar no banco, o controller confere a aula (existe, é de
turma, não foi cancelada, já começou), se o professor é o dela e se cada aluno
da lista faz parte da chamada. Só então abre uma transação: primeiro muda a aula
para `realizada` — o que trava a linha dela até o fim —, depois grava uma linha
por aluno em `frequencia`, e confirma tudo junto. Se qualquer passo falhar, nada
fica gravado. Na tela, o caminho começa em `chamada.js`: ele monta a lista de
presenças só com os alunos que receberam uma opção marcada, manda o `PUT`, e
redesenha a chamada com a resposta, que já vem relida do banco.

## Decisões

**Node.js + Express, PostgreSQL, HTML/CSS/JS puro.** É a stack fixada no TCC. O
frontend sem framework é escolha deliberada: menos coisa para aprender ao mesmo
tempo e nenhum passo de build entre salvar o arquivo e ver o resultado.

**Pasta `config/` separada de `routes/`.** `db.js` e `schema.sql` não são
funcionalidade, são infraestrutura. Ficam juntos para que trocar de banco ou mexer
no schema não obrigue a caçar arquivo no meio das rotas.

**Um pool só, exportado de `db.js`.** É a forma recomendada pelo driver `pg`. Abrir
e fechar conexão a cada requisição é lento e estoura o limite de conexões do
PostgreSQL sob carga.

**Rota e controller separados.** No `health.routes.js` a lógica está dentro da rota
porque é um teste de três linhas. Para as funcionalidades reais, a rota só diz
"esse caminho chama essa função" e o controller carrega a lógica — assim a lógica
pode ser lida e testada sem passar por HTTP.

**Sem ferramenta de migrations.** O `schema.sql` é aplicado à mão (psql ou
pgAdmin4). É simples enquanto o banco é de desenvolvimento. O preço: toda
alteração de tabela precisa ser rodada manualmente em cada máquina.

**Quando uma tabela muda, nascem duas coisas: o `schema.sql` atualizado e um
arquivo `migration_<tabela>.sql`.** O primeiro serve a quem cria o banco do zero;
o segundo, a quem já tinha o banco. A regra que os une: **depois da migração, o
banco antigo tem que ficar idêntico ao novo**. A primeira versão de
`migration_professor.sql` quebrava essa regra — acrescentava as colunas sem
`NOT NULL` — e foi corrigida. A migração usa `ALTER TABLE`, nunca `DROP TABLE`,
porque `turma.professor_id` aponta para `professor`; roda numa transação (tudo
ou nada); e usa `IF EXISTS` / `IF NOT EXISTS` para poder ser repetida.

**`bcrypt` e `jsonwebtoken` instalados antes do uso.** A tabela `usuario` já prevê
`senha_hash` e o `.env` já prevê `JWT_SECRET`; as bibliotecas ficaram declaradas
para que o login não exija mexer em dependência depois. `bcrypt` compila código
nativo na instalação — daí o campo `allowScripts` no `package.json`, que cita a
versão exata (`bcrypt@6.0.0` desde 28/09): trocar a versão sem trocar o campo faz o
npm bloquear o script de instalação.

**`arquivo` guarda caminho, não o binário.** Áudio em coluna de banco incha o dump
e deixa o backup lento. O arquivo vai para o disco, o banco guarda onde ele está.
**O preço:** um backup do banco (`pg_dump`) não leva os áudios — a pasta
`backend/uploads/` precisa ser copiada junto.

**multer para receber arquivos.** O `express.json()` só entende JSON; um arquivo
chega em `multipart/form-data`. O multer recorta esse formato, grava no disco
aos poucos (sem carregar o áudio inteiro na memória) e já traz limite de tamanho
e filtro. Sem ele, o parsing seria código nosso — o tipo de código onde mora
bug de segurança.

**Os uploads ficam em `backend/uploads/`, e não dentro de `frontend/`.** O
`express.static` publica `frontend/` inteira sem pedir login. Fora dela, a única
saída de um arquivo é a rota de download, que confere quem pede.

**O nome no disco é aleatório; o nome original fica só no banco.** Gravar com o
nome que o usuário mandou permitiria sobrescrever o arquivo de outra pessoa, ou
um nome como `../../src/server.js`.

**A extensão decide o formato, e o MIME gravado vem de uma tabela do servidor.**
O MIME que o navegador declara é tão falsificável quanto a extensão e varia de
navegador para navegador — conferir os dois recusaria arquivo legítimo sem ganho
de segurança. O download sai com `X-Content-Type-Options: nosniff` como segunda trava, para
o navegador não "adivinhar" que um arquivo disfarçado é uma página.

**O professor manda os áudios do aluno ou PDF, até 50 MB — e documento é só
PDF.** PDF abre em qualquer celular sem instalar nada. O `.docx` ficou de fora
também porque o MIME dele (71 letras) não cabe em `arquivo.tipo`
(`VARCHAR(50)`). O limite é o mesmo do aluno porque o `criarUpload()` tem um
limite por recebedor, não por formato.

**O material tem um destino só: uma turma ou um aluno.** Com os dois, não
daria para saber se o professor quis a turma inteira ou só aquele aluno. O
professor só usa as próprias turmas ativas e os alunos matriculados nelas — a
mesma regra que o deixa ouvir a prática do aluno. O admin usa qualquer turma
ou aluno ativo. Destino fora disso dá 404, a mesma resposta de "não existe".

**Uma prática é reconhecida pelo remetente, sem coluna nova.** O RF07 também
preenche `aluno_id` quando o professor manda algo a um aluno, então isso não
basta. Prática é o arquivo cujo `usuario_id` é do próprio aluno. Por isso o RF08
não precisou de migração.

**Cada um baixa o que aparece na sua lista, e nada além.** O aluno vê o
material das turmas dele e o que foi mandado só para ele; o professor, o que
ele enviou; o admin, tudo. Por isso o professor do aluno ouve a prática dele,
mas não o material que outro professor mandou só para esse aluno. O aluno
continua com o material de turma encerrada, como na agenda: o que tira o
acesso é sair da turma.

**O player recebe um *blob*, e não o endereço da rota.** Um `<audio src>` é
buscado pelo navegador sem o cabeçalho `Authorization`, e a rota recusaria. O
`arquivos.js` busca com `fetch` (com o token) e só quando a pessoa clica em
"Ouvir" — carregar a lista inteira de uma vez baixaria todos os áudios.

**O RF07 entrou na tela do RF08, e não numa tela nova.** O menu já tinha o link
"Arquivos" para os três perfis, e o cartão de um arquivo (`montarItem()`, com
Ouvir, Baixar e Excluir) é o mesmo nas duas listas: o que muda chega por
parâmetro. Cada lista guarda os próprios endereços *blob*, para que redesenhar
uma não solte o áudio que está tocando na outra.

**Excluir um áudio apaga de verdade.** A exclusão lógica de aluno e professor
existe porque outras tabelas apontam para eles. Para `arquivo` só apontam as
tabelas do RF09, que são apagadas junto (`ON DELETE CASCADE`). A ordem é banco primeiro, disco depois: se o disco falhar, sobra um
arquivo invisível; na ordem inversa, sobraria na lista um áudio quebrado.



**Frontend servido pelo próprio backend, via `express.static`.** Antes, a tela era
aberta direto do disco (`file://...`) enquanto a API rodava em `localhost:3000` —
dois endereços diferentes para a mesma aplicação, e `localhost:3000` sozinho
respondia "Cannot GET /". Servindo os dois do mesmo processo, um endereço só abre
o sistema inteiro. O `cors()` continua no código: ele segue necessário para o dia
em que o frontend for aberto de outro endereço (por exemplo, publicado num
serviço separado do backend).

**A versão vem da API, não é escrita no HTML.** `package.json` é a única fonte:
o rodapé busca `/api/versao`, que lê o `version` do arquivo. Se o número fosse
digitado direto no HTML também, um dia os dois desencontrariam — é a mesma lógica
de nunca duplicar a URL da API ou uma senha em dois lugares.

**Autenticação por JWT, e não por sessão guardada no servidor.** O servidor
assina um token com o `JWT_SECRET` e o entrega ao navegador; a cada requisição,
ele confere a assinatura em vez de procurar a sessão numa tabela. Não guardar
sessão significa nenhuma tabela nova, nenhuma limpeza de sessão vencida e
nenhum estado na memória do processo — o servidor pode reiniciar sem derrubar
quem está logado. **O preço, assumido:** um token emitido não tem como ser
cancelado antes de expirar. É por isso que `GET /api/auth/eu` relê o usuário no
banco filtrando por `ativo = true`, em vez de responder direto do token: sem
essa consulta, alguém excluído continuaria entrando até o prazo de 8 horas
acabar.

**`autenticar` e `autorizar` são dois middlewares e não um.** Um responde "quem
é você" (401 quando não dá para saber), o outro responde "você pode isto" (403
quando dá para saber e a resposta é não). Separados, a permissão de cada rota
fica legível na própria linha da rota — `autorizar('admin')` — sem precisar
abrir o controller.

**O token fica no `sessionStorage`, não no `localStorage` nem em cookie.** O
`sessionStorage` apaga o token quando a aba fecha, o que importa no cenário real
do sistema: o computador compartilhado da secretaria da escola. Um cookie
`httpOnly` seria mais seguro (o JavaScript não o enxergaria, então um XSS não o
roubaria), mas traria CORS com credenciais, proteção contra CSRF e uma
dependência a mais — três assuntos novos para resolver e explicar. A troca entre
`sessionStorage` e `localStorage` é de uma palavra, num arquivo só.

**A barra de sessão é desenhada por JavaScript, não escrita no HTML.** Mesma
ideia do `rodape.js`: `sessao.js` acha o `<header>` e acrescenta a barra. Assim
`index.html` e `alunos.html` ganharam uma linha de `<script>` cada e o `<nav>`
delas não foi tocado — o que evita conflito no Git com quem está acrescentando
telas ao menu ao mesmo tempo.

**Changelog interpretado em JavaScript puro, sem biblioteca de markdown.**
`frontend/js/rodape.js` entende só o suficiente do formato que o `CHANGELOG.md`
usa (`##`, `###`, listas com `-`). Uma biblioteca de markdown resolveria mais
casos, mas o projeto não tem nenhum outro texto em markdown para mostrar na tela,
e RNF02 pede frontend sem framework nem dependência extra — o interpretador
pequeno já resolve o problema real.

**Os links de gestão entram pelo `sessao.js`, não pelo HTML de cada tela.** A
barra lateral é escrita à mão em cada HTML e é a mesma para qualquer visitante.
O que muda com o perfil (Alunos, Professores, Cursos, Turmas, Agenda, Chamada,
Arquivos)
fica numa tabela só, `MENU_DO_PERFIL`, e o `sessao.js` — que já roda em toda
tela e já sabe quem está logado — acrescenta a seção "Gestão". Escrever os
links em cada HTML obrigaria a mexer em 18 arquivos a cada tela nova, e ainda
assim seria preciso JavaScript para esconder o que não é do perfil. Esconder um
link não é segurança: quem barra de verdade é a API, com 401 e 403.

**A política de segurança (CSP) libera `blob:` só para mídia.** O `server.js`
manda o cabeçalho `Content-Security-Policy`, que diz ao navegador de onde a
página pode carregar cada coisa. A tela de Arquivos não pode usar
`<audio src="/api/arquivos/1">`, porque o `<audio>` não manda o token; ela baixa
o áudio com `fetch` e toca uma cópia na memória do navegador, cujo endereço
começa com `blob:`. Sem `media-src 'self' blob:`, o navegador recusa essa cópia
e o player fica mudo, sem mensagem. A liberação vale só para áudio e vídeo;
scripts continuam restritos ao próprio servidor.

**O limite de login conta só as tentativas erradas.** O `limite.js` conta por IP,
e numa demonstração todo mundo usa o mesmo computador. Contando também os logins
certos, a quinta troca de usuário em 15 minutos bloqueava o sistema. O objetivo
do limite — frear quem tenta adivinhar senha — continua intacto: cinco senhas
erradas ainda bloqueiam, inclusive a senha certa que vier depois.

**Aluno pode se cadastrar sozinho; professor, não.** `POST /api/alunos` é
público (com limite de tentativas); `POST /api/professores` exige
`autorizar('admin')`. Uma conta de aluno só enxerga o que é dela; uma de
professor lista os alunos das turmas dele e ouve as práticas deles. O cadastro de
professor chegou a ser público em 22/09, e o teste da integração mostrou um
estranho, sem login, virando professor e ouvindo as gravações — por isso foi
fechado em 23/09, e a tela pública de cadastro de docente saiu.

**O professor só enxerga os alunos das próprias turmas ativas (28/09).** Até
então, qualquer professor listava todos os alunos e ouvia todas as práticas; o
comentário do RF08 já deixava a restrição "como melhoria", porque ela dependia
das tabelas do RF03. A regra é a mesma em três lugares — a lista de alunos, a
lista de práticas e o download —, e o download confere no banco a cada pedido,
porque esconder o aluno na tela não impede um pedido feito à mão.

**Só o admin matricula (28/09).** Consequência direta da regra acima: a lista
de onde o professor escolhia quem matricular passou a ter só os alunos que já
estavam com ele, e ficava vazia numa turma nova. Dar ao professor uma lista de
todos os alunos, só para matricular, desfaria a restrição. Quem monta a turma
passa a ser a secretaria; o professor vê a lista da turma, sem alterá-la.

**Chamada só em aula de turma.** Grupo extracurricular fica só na agenda, como
o TCC o descreve. Estender a chamada a ele seria aprofundar algo que já está
fora da lista de requisitos.

**Salvar a chamada marca a aula como `realizada`.** O status existia no schema
desde o RF04, sem ninguém que o usasse. Como o `aula.controller.js` só remarca e
cancela aula `agendada`, a aula com chamada fica travada na agenda sem nenhuma
linha nova de código ali. Dentro da transação, esse `UPDATE` vem **antes** das
presenças: ele trava a linha da aula, e um cancelamento que chegue ao mesmo
tempo espera e desiste, em vez de deixar presença gravada numa aula cancelada.

**`presente` nulo não é falta.** Na resposta da chamada, `true` é presença,
`false` é falta e `null` é "ainda sem registro". Juntar os dois últimos faria
toda aula sem chamada contar como falta de todo mundo.

**A chamada é um `PUT` que pode ser repetido.** O `INSERT ... ON CONFLICT`
apoia-se no `UNIQUE (aula_id, aluno_id)` que o schema já tinha: a primeira vez
insere, as seguintes só trocam o valor. É o que permite corrigir um aluno sem
reenviar a turma inteira, e nunca duplica linha.

**A chamada tem tela própria, e não um botão na Agenda.** A Agenda lista de hoje
em diante, e a chamada esquecida de ontem sumiria dela. A tela nova reaproveita
a rota da Agenda com outra janela de datas (7 dias para trás, ajustável na
tela), então não precisou de backend novo, e deixou o `agenda.js` intocado.

**Presença e falta são duas opções por aluno, não uma caixa de marcar.** A caixa
desmarcada não distinguiria "faltou" de "ainda não marquei", e a API guarda os
dois separados. Aluno sem opção marcada fica fora do envio e continua sem
registro.

**As presenças do aluno são uma seção da tela Classes, não uma tela própria.**
Classes já era a tela do aluno com dados de verdade, e a seção não criou
arquivo nem mexeu no menu. Não ficam dentro do cartão de cada turma porque o
cartão só existe enquanto há matrícula, e o histórico de uma turma deixada
sumiria. A contagem ("2 presenças e 1 falta") é somada no navegador, sobre a
mesma lista; porcentagem ficou de fora de propósito (decidido em 23/09).

**Notificações dentro do sistema, e não por e-mail (RF09, 22/10).** O e-mail
já existia (o aviso de aula cancelada), mas depende de um servidor SMTP
configurado, e sem ele a banca não veria nada acontecer. A notificação fica no
banco e aparece em qualquer tela, sem dependência externa. Um mecanismo só
cobre os dois sentidos: o aluno é avisado do material novo, e o professor, da
prática nova e de cada aluno que abriu o material.

**O registro de download é uma tabela própria, com chave primária composta.**
`arquivo_download (arquivo_id, usuario_id)` guarda só o primeiro acesso. O
`INSERT ... ON CONFLICT DO NOTHING RETURNING` deixa o banco decidir se é o
primeiro: só nesse caso volta uma linha, e só então o professor é avisado.
Conferir antes com um `SELECT` deixaria dois cliques simultâneos gerarem dois
avisos. Ouvir no player conta como acesso, porque o player baixa pela mesma rota.

**As tabelas do RF09 apagam em cascata com o arquivo.** A exclusão de arquivo
continua definitiva (RN21); `ON DELETE CASCADE` leva junto o registro de
download e as notificações dele. Sem isso, um material já baixado não poderia
mais ser apagado, e avisar de um material que não existe só confundiria.

**O aviso nunca desfaz a ação que o causou.** `notificar()` engole o próprio
erro e escreve no log. Pôr envio e aviso na mesma transação faria uma falha no
aviso apagar um material que já tinha chegado, o que é pior do que um aviso
perdido.

**As capas das turmas são públicas, os outros arquivos não.** Materiais e
práticas só saem pela rota de download, que confere o token. A capa sai direto
do `express.static`, em `/uploads/capas/`, porque a tag `<img>` não manda o
token e uma foto de capa não é dado pessoal. Pelo mesmo motivo, a CSP aceita
imagem de qualquer endereço `http`/`https`: a capa pode ser um link externo.
Script continua só do próprio servidor, que é o que protege contra XSS.

## O que cada requisito vai encostar

Mapa entre os requisitos do TCC e as peças do código, para saber onde mexer.

| Requisito | Tabelas | Arquivos que vão nascer |
|---|---|---|
| RF01 — CRUD de alunos | `usuario`, `aluno` | `routes/aluno.routes.js`, `controllers/aluno.controller.js`, tela no frontend |
| RF02 — CRUD de professores ✅ | `usuario`, `professor` | `routes/professor.routes.js`, `controllers/professor.controller.js`, `frontend/professores.html`, `js/professores.js`, `config/migration_professor.sql` |
| RF03 — turmas e cursos ✅ | `curso`, `turma`, `matricula` | `routes/curso.routes.js`, `routes/turma.routes.js`, controllers e telas; a matrícula é o que liga aluno à turma |
| RF04 — agendamento de aulas ✅ | `aula`, `grupo`, `grupo_membro` | `routes/aula.routes.js`, `controllers/aula.controller.js`, `routes/grupo.routes.js`, tela de agenda e migração |
| RF05 — frequência ✅ | `frequencia`, `aula.status` | `routes/frequencia.routes.js`, `controllers/frequencia.controller.js`, `frontend/chamada.html`, `js/chamada.js`, e a seção Minhas presenças em `classes.html` e `js/classes.js`. Sem migração: a tabela já estava no schema |
| RF06 — autenticação e perfis ✅ | `usuario.perfil`, `recuperacao_senha` | `routes/auth.routes.js`, `middlewares/autenticacao.js`, `middlewares/limite.js`, `controllers/auth.controller.js`, `utils/mailer.js`, `scripts/criar-admin.js`, `frontend/login.html`, `js/login.js`, `js/sessao.js`, telas de recuperação |
| RF08 — áudio do aluno ✅ | `arquivo` | `routes/arquivo.routes.js`, `middlewares/upload.js`, `controllers/arquivo.controller.js`, `frontend/arquivos.html`, `js/arquivos.js`, a pasta `backend/uploads/` |
| RF07 — arquivos do professor ✅ | `arquivo` | acréscimos nos arquivos do RF08: outra chamada de `criarUpload()`, rotas novas em `arquivo.routes.js`, o caso da turma em `podeAcessar()`, e os blocos de envio e de materiais em `arquivos.html` e `js/arquivos.js` |
| RF09 — notificações ✅ | `notificacao`, `arquivo_download` | `utils/notificacoes.js`, `routes/notificacao.routes.js`, `controllers/notificacao.controller.js`, `frontend/notificacoes.html`, `js/notificacoes.js`, `config/migration_notificacao.sql`, e acréscimos em `arquivo.controller.js` e `js/sessao.js` |

RF06 é pré-requisito prático dos outros: sem saber quem está logado, não dá para
decidir o que cada perfil pode ver. Os CRUDs agora usam os middlewares, as telas
mandam `Sessao.cabecalho()`, e o middleware relê o perfil ativo no banco antes de
autorizar cada requisição.

## Decisões de modelagem que já estão no schema

Três pontos foram corrigidos antes da primeira execução do `schema.sql`, enquanto
o banco ainda estava vazio e a mudança era gratuita:

1. **Exclusão é lógica.** `usuario.ativo` existe porque RF01 e RF02 pedem excluir
   aluno e professor, mas as chaves estrangeiras de `matricula` e `frequencia`
   bloqueiam o `DELETE` de quem tem histórico. Excluir vira
   `UPDATE usuario SET ativo = false`, e toda listagem filtra por `ativo = true`.
   O controle mora só em `usuario` — `aluno` e `professor` não repetem a coluna.
2. **Horário é coluna tipada, não texto.** `turma` guarda `dia_semana` +
   `hora_inicio` + `hora_fim`; `aula` guarda `data` + `hora_inicio` + `hora_fim`.
   Com `VARCHAR` seria impossível ordenar por horário ou descobrir que o mesmo
   professor ou aluno foi marcado em duas aulas ao mesmo tempo, que é o coração do RF04.
3. **`arquivo` aponta para turma e para aluno**, ambos opcionais. RF07 vincula o
   arquivo do professor a uma turma *ou* a um aluno; RF08 é áudio do próprio
   aluno. `nome_original` existe para o download sair com nome legível. O RF08
   usou `tipo` para guardar o MIME (`audio/mpeg`), que o download devolve como
   `Content-Type`.
4. **Turma solicitada não é uma tabela separada.** A solicitação já nasce como
   uma turma com `status = 'solicitada'` e `solicitante_id`; assim o administrador
   aprova a mesma entidade, sem copiar dados nem perder o professor que pediu.
5. **Horários do mesmo professor não podem colidir.** A API verifica interseção
   de intervalos por dia antes de criar ou aprovar uma turma ativa.
6. **Grupo extracurricular é opcional.** Uma aula aponta para uma turma ou para
   um grupo, nunca para os dois. Grupo, professor responsável e participantes
   podem começar vazios; quando há participantes, o sistema também evita choque
   com aulas deles. Cancelamentos feitos por professores exigem seis horas de
   antecedência e geram avisos para alunos afetados e administradores.

## Fora do escopo

O TCC registra como trabalhos futuros a gestão completa de grupos musicais,
controle de salas, módulo financeiro, empréstimo de instrumentos e integração com
plataformas de EAD. O RF04 implementa apenas o mínimo de grupos necessário para
agendar encontros extracurriculares opcionais; descoberta social e controle de
salas continuam fora do escopo.
