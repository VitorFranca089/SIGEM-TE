# SIGEM - Sistema de Gestao para Escolas de Musica

Esqueleto inicial do projeto, baseado na stack definida no TCC:
Node.js + Express (backend), PostgreSQL (banco), HTML/CSS/JS puro (frontend).

## Estrutura de pastas

```
sigem/
├── ARQUITETURA.md             -> como as pecas se conectam e por que
├── CLAUDE.md                  -> guia do projeto para o Claude Code
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js          -> conexao com o PostgreSQL
│   │   │   └── schema.sql     -> script de criacao das tabelas
│   │   ├── controllers/       -> logica de cada funcionalidade (RF01 a RF08)
│   │   ├── middlewares/       -> login (autenticacao), limite de tentativas e recebimento de arquivos (upload)
│   │   ├── routes/            -> health, auth, alunos, professores, cursos, turmas, aulas, grupos, arquivos
│   │   └── server.js          -> arquivo principal do backend
│   ├── uploads/               -> audios enviados; criada sozinha, fora do Git
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html             -> pagina inicial e menu
    ├── css/style.css          -> estilo de todas as telas
    └── js/main.js
```

## Como rodar pela primeira vez

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Abra o arquivo `.env` e preencha `DB_PASSWORD` com a senha que voce definiu
na instalacao do PostgreSQL.

Para ativar a recuperacao de senha, preencha tambem `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD` e `EMAIL_FROM` conforme o seu provedor de e-mail.
O codigo enviado expira em 15 minutos por padrao; esse prazo pode ser alterado
com `RECUPERACAO_EXPIRA_MINUTOS`. Sem SMTP configurado, o cadastro e o login
continuam funcionando; a API mantém a mesma resposta genérica da recuperação
para não revelar quais e-mails possuem conta, e registra a falha no servidor.

Crie o banco `sigem_db`, se ainda nao existir, e rode o script das tabelas:

```bash
psql -h localhost -U postgres -d sigem_db -f src/config/schema.sql
```

Ele vai pedir a senha do PostgreSQL. Para conferir que deu certo:

```bash
psql -h localhost -U postgres -d sigem_db -c '\dt'
```

Devem aparecer 14 tabelas. O pgAdmin4 continua util para *olhar* os dados.

Para olhar os dados sem sair do VS Code, use a extensão **PostgreSQL**, de
Chris Kolkman (`ckolkman.vscode-postgres`):

1. Clique no ícone do elefante, na barra da esquerda, e depois no **+**.
2. Preencha, nesta ordem: `localhost`, `postgres`, a senha do `DB_PASSWORD`,
   `5432`, "Standard Connection", `sigem_db` e o nome `SIGEM local`.
3. Para ver uma tabela: botão direito nela → **Select...** → **Run Select Top 1000**.
4. Para escrever uma consulta: botão direito em `sigem_db` → **New Query**, e
   **F5** roda.

No terminal, o mesmo acesso é `psql -h localhost -U postgres -d sigem_db`:
`\dt` lista as tabelas e `\q` sai.

O `schema.sql` so tem `CREATE TABLE`, nunca `DROP` - assim ninguem apaga o banco
sem querer. Se precisar recriar as tabelas do zero, os `DROP` sao feitos a mao.

Em bancos que ja existiam antes da versao 0.5.0, aplique as tres migracoes
abaixo **nesta ordem** - `migration_recuperacao_senha.sql`, depois
`migration_rf03.sql` (secao RF03) e por ultimo `migration_rf04.sql` (secao
RF04) - a ordem em que as funcionalidades nasceram, e a que foi testada. As
tres podem ser rodadas de novo sem estragar nada. A primeira:

```bash
psql -h localhost -U postgres -d sigem_db -v ON_ERROR_STOP=1 -f src/config/migration_recuperacao_senha.sql
```

Suba o servidor:

```bash
npm run dev
```

Se tudo estiver certo, o terminal vai mostrar:
`Servidor do SIGEM rodando em http://localhost:3000`

Teste no navegador: `http://localhost:3000/api/health` deve retornar um JSON
com `"status": "ok"`. Depois teste `http://localhost:3000/api/health/db` -
se retornar o horario do banco, a conexao com o PostgreSQL esta funcionando.

### 2. Frontend

Nao precisa de instalacao nem de passo separado. O backend serve as telas
junto: com `npm run dev` rodando, abra `http://localhost:3000/` no navegador.

Clique no botao "Testar conexao com a API" na pagina -
se aparecer o horario do banco em verde, o ambiente inteiro (frontend +
backend + banco) esta funcionando de ponta a ponta.

## RF03: cursos e turmas

Depois de aplicar o `schema.sql` em um banco novo, ou a migracao abaixo em um
banco que ja existia:

```bash
psql -h localhost -U postgres -d sigem_db -v ON_ERROR_STOP=1 -f src/config/migration_rf03.sql
```

Para habilitar capas editaveis nas turmas, aplique tambem:

```bash
psql -h localhost -U postgres -d sigem_db -v ON_ERROR_STOP=1 -f src/config/migration_capas_turma.sql
```

O administrador cadastra cursos e turmas em `Cursos` e `Turmas`. Professores
podem solicitar uma turma informando curso, nome e horario; o administrador
aprova, recusa, renomeia, troca o professor, atualiza o horario ou encerra a
turma. Alunos sao adicionados dentro da turma, e a exclusao e logica para
preservar historico.

## RF04: agenda de aulas

Depois de aplicar o `schema.sql` em um banco novo, ou a migracao abaixo em um
banco existente:

```bash
psql -h localhost -U postgres -d sigem_db -v ON_ERROR_STOP=1 -f src/config/migration_rf04.sql
```

A tela `agenda.html` lista aulas regulares e encontros extracurriculares. Uma
aula pertence a uma turma ou a um grupo, nunca aos dois. Grupos, professores e
alunos participantes sao opcionais. O sistema recusa conflitos de professor e
de alunos, preserva cancelamentos e permite ao professor cancelar apenas com
pelo menos seis horas de antecedencia. O cancelamento tenta enviar aviso aos
alunos envolvidos e a todos os administradores ativos; para isso, o SMTP do
`.env` precisa estar configurado.

## RF05: chamada

Nao precisa de migracao: a tabela `frequencia` ja estava no `schema.sql`.

A tela `chamada.html` (link "Chamada" na barra lateral, so para administrador e
professor) lista as aulas de turma dos ultimos 7 dias; o campo "Aulas a partir
de" deixa voltar mais. Escolhida uma aula, o professor marca presenca ou falta
de cada aluno. A chamada abre no horario de inicio da aula e pode ser corrigida
depois. Salvar marca a aula como realizada, e ela nao pode mais ser remarcada
nem cancelada.

## RF09: notificacoes

Em bancos que ja existiam antes da versao 0.11.0, crie as duas tabelas novas
(`arquivo_download` e `notificacao`). Pode ser rodada de novo sem estragar nada:

```bash
psql -h localhost -U postgres -d sigem_db -v ON_ERROR_STOP=1 -f src/config/migration_notificacao.sql
```

O link "Notificações" aparece na barra lateral dos tres perfis, com o numero
das nao lidas. O aluno e avisado quando chega material para a turma dele ou
para ele; o professor, quando um aluno da turma envia uma pratica e quando um
aluno abre pela primeira vez um material que ele enviou. Nao depende de SMTP.

## Proximos passos

Com o ambiente validado, o desenvolvimento de cada funcionalidade (RF01 a RF09,
conforme a Secao 4 do TCC) segue o padrao:

1. Criar a rota em `backend/src/routes/`
2. Criar o controller correspondente em `backend/src/controllers/`
3. Criar a tela correspondente no frontend (`frontend/`), com base no
   wireframe feito no Figma
