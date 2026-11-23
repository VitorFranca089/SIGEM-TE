# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui, da mais
recente para a mais antiga.

## [0.13.0] - 2026-11-22

Nesta versão: todo o texto das telas ganha acento, e o aluno entra direto nas próprias classes.

### Alterado
- Ao entrar, o aluno vai direto para Classes, com as próprias turmas e presenças.
  A antiga Página do aluno, que mostrava cartões de exemplo, saiu do sistema.
- Todo o texto das telas e as mensagens de erro passam a ter acento: "Gestão",
  "Área acadêmica", "Práticas dos alunos", "E-mail ou senha inválidos" e as demais.

## [0.12.1] - 2026-11-22

Nesta versão: a barra lateral e os formulários de Turmas e Agenda ficam certos em qualquer tela.

### Corrigido
- A barra lateral não corta mais os links nem o nome de quem está logado em
  telas mais baixas, como a de um projetor. Quando falta espaço, ela rola.
- Ao pedir uma turma, o professor não vê mais os campos Professor e Status,
  que só o administrador preenche. Na Agenda, a lista de grupos só aparece
  com o tipo "grupo" marcado.
- A prévia da capa não mostra mais um ícone de imagem quebrada antes de a
  foto ser escolhida.

## [0.12.0] - 2026-11-03

Nesta versão: cada turma ganha uma capa com foto, ajustável pelo professor.

### Adicionado
- Na tela Turmas, o professor da turma e o administrador escolhem a capa:
  colando o link de uma foto ou enviando uma imagem (.jpg, .png ou .webp, de
  até 5 MB).
- A capa pode ser enquadrada, movendo a foto na horizontal e na vertical e
  aproximando até 3 vezes, com uma prévia antes de salvar.
- Na tela Classes, cada turma do aluno aparece com a capa dela. Turma sem
  capa própria ganha uma foto de acordo com o instrumento do curso.
- A página inicial do aluno passa a mostrar fotos nos cartões de aulas e de
  trilhas.

## [0.11.0] - 2026-10-22

### Adicionado
- Notificações dentro do sistema, para os três perfis. O link "Notificações",
  na barra lateral, mostra em vermelho quantas ainda não foram lidas.
- O aluno é avisado quando o professor envia um material para a turma dele ou
  só para ele.
- O professor é avisado quando um aluno abre pela primeira vez um material que
  ele enviou, e quando um aluno das turmas dele envia uma gravação de prática.
  Abrir o mesmo material de novo não gera outro aviso.
- Na tela de notificações, as que chegaram desde a última visita aparecem
  destacadas como "Nova". Ao abrir a tela, todas passam a contar como lidas.

## [0.10.0] - 2026-10-07

### Adicionado
- Envio de materiais pelo professor (RF07): na tela Arquivos, o professor e o
  administrador enviam gravações (.mp3, .m4a, .ogg, .opus, .wav) e documentos
  em PDF, de até 50 MB cada, para uma turma ou para um aluno.
- O professor envia só para as próprias turmas ativas e para os alunos delas.
  O administrador envia para qualquer turma ou aluno ativo.
- Na tela Arquivos, acima das gravações, a lista de materiais. O aluno vê em
  "Materiais recebidos" o que foi enviado às turmas dele e a ele. O professor
  vê em "Materiais enviados" o que mandou. O administrador vê tudo em "Todos
  os materiais".
- Cada material mostra o destino, quem enviou e quando, com os botões Baixar,
  Ouvir (nos áudios) e Excluir (só para quem enviou).
- O aluno continua com acesso ao material de uma turma depois que ela é
  encerrada.

### Alterado
- O número da versão saiu do fim da página e passou para o pé da barra
  lateral, sempre à vista.

## [0.9.0] - 2026-09-28

### Adicionado
- A Pesquisa mostra os cursos, turmas, grupos e professores cadastrados no
  sistema, em vez de uma lista fixa de exemplo.
- Comando `npm run testar-smtp`, para conferir se o envio de e-mail está
  configurado.

### Alterado
- O professor vê e ouve só os alunos das próprias turmas ativas.
- Só o administrador matricula e desmatricula alunos. Na tela Turmas, o
  professor vê a lista de alunos da turma, sem poder alterá-la.
- A tela de login ficou mais larga e com letras maiores.
- No modo noturno, a barra lateral ficou verde.
- A página inicial não tem mais o botão "Novo aluno" nem o convite para
  entrar. O cadastro de aluno continua pelo link "Crie um cadastro", na tela
  de login.
- As bibliotecas de envio de e-mail e de senha foram atualizadas, e o sistema
  ficou sem alertas de segurança conhecidos nas bibliotecas.

### Corrigido
- O aviso de Caps Lock aparecia mesmo com o Caps Lock desligado.
- No login, o campo de senha ficava espremido pelo aviso de Caps Lock.
- O e-mail de aula cancelada não trazia o nome certo da turma. O de grupo
  agora diz "Reunião cancelada".
- À noite, o cadastro de alunos e de professores aceitava como data de
  nascimento o dia seguinte.
- Atualizar um banco antigo para o agendamento podia falhar ao rodar a
  migração de novo.

## [0.8.0] - 2026-09-23

### Adicionado
- Chamada (RF05): o professor e o administrador marcam presença ou falta de
  cada aluno numa aula de turma, pela nova tela Chamada da barra lateral.
- A tela Chamada lista as aulas de turma dos últimos 7 dias, da mais recente
  para a mais antiga, com a situação de cada uma ("Sem chamada" ou "Chamada
  feita"). Dá para escolher uma data mais antiga.
- A chamada abre no horário de início da aula e pode ser corrigida depois.
  Aluno sem marcação fica "sem registro", que é diferente de falta.
- O professor vê e faz a chamada só das aulas das próprias turmas.
- O aluno vê as próprias presenças e faltas na tela Classes, na seção "Minhas
  presenças", com a contagem de cada uma. Aulas de turmas que ele já deixou
  continuam na lista.

### Alterado
- Salvar a chamada marca a aula como realizada na Agenda: ela não pode mais
  ser remarcada nem cancelada.

## [0.7.0] - 2026-09-23

### Adicionado
- Seção "Gestão" na barra lateral, com os atalhos de cada perfil: o
  administrador chega a Alunos, Professores, Cursos, Turmas, Agenda e
  Arquivos; o professor, a Turmas, Agenda e Arquivos; o aluno, à Página do
  aluno, Agenda e Arquivos.

### Alterado
- A tela Arquivos ganhou a barra lateral e o modo noturno das outras telas.
- O limite de tentativas de login passou a contar só as senhas erradas:
  trocar de usuário várias vezes seguidas não bloqueia mais o computador.
- O cadastro de professor voltou a ser feito só pelo administrador. O
  cadastro aberto, sem login, ficou só para alunos.

### Removido
- A tela pública "Cadastro de docente".

### Corrigido
- Agendar uma aula dava erro e não salvava nada.
- O player da tela Arquivos não tocava as gravações.
- Bancos antigos atualizados pela `migration_rf04.sql` aceitavam aula sem
  horário ou sem autor. A migração agora exige os dois, como num banco novo.
- O professor não conseguia agendar aula pela Agenda: a lista de turmas do
  formulário ficava vazia.
- No computador, os cartões das gravações da tela Arquivos apareciam sem
  formatação; só no celular estavam certos.

## [0.6.0] - 2026-09-22

### Adicionado
- Agenda de aulas (RF04): o administrador e o professor marcam aulas para uma
  turma, e cada aluno vê as aulas das turmas em que está matriculado.
- Encontros extracurriculares opcionais de grupos na mesma agenda.
- O sistema recusa aula que choca com outra aula ou turma do mesmo professor
  ou dos mesmos alunos.
- O professor pode cancelar uma aula com pelo menos seis horas de
  antecedência; o administrador pode cancelar a qualquer momento.
- Aviso de cancelamento por e-mail para os alunos e administradores (precisa
  de um servidor de e-mail configurado no `.env`).
- Migração `migration_rf04.sql` para bancos existentes.

## [0.5.0] - 2026-09-22

### Adicionado
- Cadastro e consulta de cursos pelo administrador (RF03).
- Cadastro de turmas ligadas a um curso, um professor e um horário (RF03).
- Professores podem solicitar novas turmas; administradores podem aprovar,
  recusar, editar, trocar professor ou horário e encerrar turmas.
- Matrícula de alunos dentro da turma, com inclusão e remoção.
- Cadastro público: aluno e professor podem criar a própria conta, sem
  passar pelo administrador.
- Recuperação de senha por código enviado por e-mail (precisa de um servidor
  de e-mail configurado no `.env`).
- Visual novo, com barra lateral, modo noturno e alto contraste.
- Telas de pesquisa, contatos de docentes, grupos, classes, conta e a Página
  do aluno.
- Migrações `migration_rf03.sql` e `migration_recuperacao_senha.sql` para
  bancos existentes.

### Alterado
- Todas as telas e rotas de dados passam a exigir login, com permissão por
  perfil. Ficam abertos só o login, os cadastros públicos, a recuperação de
  senha, a versão e o changelog.
- Senhas novas precisam de pelo menos 8 caracteres, com letra maiúscula,
  letra minúscula, número e caractere especial.
- O cadastro de alunos passou a pedir a confirmação da senha.
- O login fica bloqueado por 15 minutos depois de 5 tentativas.
- Cursos e turmas usam exclusão lógica para preservar o histórico.
- O sistema recusa duas turmas ativas do mesmo professor no mesmo horário.
- Um JSON malformado enviado à API recebe uma resposta de erro em JSON, sem
  detalhes internos do servidor.

## [0.4.0] - 2026-09-19

### Adicionado
- Envio de gravações de áudio pelo aluno (RF08), na nova tela Arquivos: o
  aluno envia a gravação da própria prática e pode ouvi-la, baixá-la ou
  excluí-la.
- São aceitos os formatos MP3, M4A, OGG e WAV, com até 50 MB por arquivo.
- Professores e administradores escolhem um aluno na mesma tela e ouvem as
  gravações dele.
- Cada aluno só vê e ouve as próprias gravações, e só quem enviou uma gravação
  pode excluí-la.
- Link para a tela Arquivos no menu.

## [0.3.0] - 2026-09-16

### Adicionado
- Cadastro de professores (RF02): cadastrar, editar, listar e excluir, com
  telefone, CPF, data de nascimento e especialidades.
- O CPF é conferido pelos dígitos verificadores, e o mesmo CPF não pode ser
  usado por dois professores, esteja ele escrito com ou sem pontuação.
- Professores cadastrados já conseguem entrar no sistema com o próprio
  e-mail e senha.
- A tela de professores mostra quem está logado e a versão do sistema.

### Alterado
- A tabela de professores do banco mudou. Bancos criados antes desta versão
  precisam rodar a migração `migration_professor.sql` uma vez.

## [0.2.0] - 2026-09-09

### Adicionado
- Tela de entrada no sistema: agora é possível fazer login com e-mail e
  senha. O cabeçalho passa a mostrar quem está usando o sistema, com um
  botão para sair.
- Perfis de acesso (administrador, professor e aluno). O sistema já sabe
  distinguir o que cada perfil pode fazer.
- Criação do primeiro administrador pelo comando `npm run criar-admin`.

### Alterado
- Quem foi excluído do sistema não consegue mais entrar, e perde o acesso
  na hora, mesmo que já estivesse com a sessão aberta.

## [0.1.0] - 2026-09-09

Primeira versão numerada do projeto. Reúne tudo que foi construído desde a
estrutura inicial até aqui.

### Adicionado
- Estrutura inicial do projeto: backend em Node.js e Express, frontend em
  HTML, CSS e JavaScript puro, conexão com PostgreSQL.
- Cadastro de alunos (RF01): cadastrar, editar, listar e excluir. A exclusão
  preserva o histórico acadêmico em vez de apagar o registro.
- Validação de cadastro no servidor: nome, e-mail, senha e data de nascimento.
- O backend passou a servir também as telas do frontend: o sistema inteiro
  abre em um endereço só, http://localhost:3000/.
- Documentação do projeto: ARQUITETURA.md, GUIA-DA-BANCA.md e ROADMAP.md.
- Número da versão no rodapé de cada tela, com este changelog disponível ao
  clicar nele.
