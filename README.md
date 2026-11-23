# SIGEM — Sistema de Gestão para Escolas de Música

## Descrição do projeto

O **SIGEM** é um sistema web para a gestão de escolas de música. Ele reúne em um
só lugar o cadastro de alunos e professores, a organização de cursos e turmas, a
agenda de aulas, a chamada (frequência) e a troca de arquivos entre professores e
alunos, como partituras, materiais de apoio e gravações de prática.

O sistema tem três perfis de acesso, cada um com as suas telas e permissões:

- **Administrador:** gerencia alunos, professores, cursos e turmas, e aprova as
  turmas solicitadas pelos professores.
- **Professor:** agenda aulas, faz a chamada, envia materiais e acompanha as
  práticas enviadas pelos alunos.
- **Aluno:** consulta as aulas e a frequência, baixa materiais e envia gravações
  de prática.

### Funcionalidades

| Requisito | Funcionalidade |
|-----------|----------------|
| RF01 | Cadastro, edição e exclusão de alunos |
| RF02 | Cadastro, edição e exclusão de professores |
| RF03 | Gestão de cursos e turmas, com matrícula de alunos |
| RF04 | Agenda de aulas e encontros, com bloqueio de conflitos de horário |
| RF05 | Chamada (registro de presença e falta) |
| RF06 | Login, perfis de acesso e recuperação de senha por e-mail |
| RF07 | Envio de materiais do professor para a turma ou para um aluno |
| RF08 | Envio de gravações de prática pelo aluno |
| RF09 | Notificações dentro do sistema |

## Integrantes

- Anita Felício dos Santos
- Daniel Carrapeiro Mendes
- Vitor Miguel Mendes de França

## Tecnologias utilizadas

| Camada | Tecnologias |
|--------|-------------|
| Backend | Node.js, Express |
| Banco de dados | PostgreSQL 16, rodando em Docker (Docker Compose) |
| Frontend | HTML, CSS e JavaScript puro, servidos pelo próprio backend |
| Autenticação | JSON Web Token (`jsonwebtoken`) e senhas com hash `bcrypt` |
| Upload de arquivos | Multer |
| E-mail | Nodemailer (SMTP), usado na recuperação de senha e nos avisos de cancelamento |
| Desenvolvimento | Nodemon (reinicia o servidor a cada alteração) |

## Instruções para executar o sistema

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18 ou mais recente)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) aberto e em execução
- Git

Não é preciso instalar o PostgreSQL: o banco roda dentro de um container Docker.

### 1. Baixar o projeto

```bash
git clone https://github.com/VitorFranca089/SIGEM-TE.git
cd SIGEM-TE
```

### 2. Subir o banco de dados

```bash
docker compose up -d
```

Na primeira execução, o Docker baixa a imagem do PostgreSQL e cria o banco
`sigem_db` com todas as tabelas (`backend/src/config/schema.sql`). O banco fica
disponível na porta **5433**, que só aceita conexões da própria máquina. A porta
não é a 5432 padrão para não conflitar com outros projetos.

### 3. Configurar o backend

Crie o arquivo `backend/.env` a partir do modelo. O modelo já vem configurado
para o banco do Docker.

```bash
cd backend
cp .env.example .env        # no PowerShell ou no CMD: copy .env.example .env
npm install
```

O SMTP é opcional. Sem ele, o sistema funciona normalmente, exceto pelo envio de
e-mails. Para ativar, preencha as variáveis `SMTP_*` no `.env`.

### 4. Carregar os dados de demonstração (opcional, recomendado)

Preenche o banco vazio com uma escola de exemplo, com cursos, turmas, aulas,
chamadas e arquivos:

```bash
npm run dados-demo
```

Para começar com o banco vazio, crie apenas o administrador com
`npm run criar-admin`.

### 5. Iniciar o sistema

```bash
npm run dev
```

Quando aparecer `Servidor do SIGEM rodando em http://localhost:3000`, abra
**http://localhost:3000/** no navegador.

### Logins de demonstração

Disponíveis depois do passo 4. A senha é a mesma para todos: **`Banca@2026`**

| Perfil        | E-mail              |
|---------------|---------------------|
| Administrador | admin@sigem.demo    |
| Professor     | helena@sigem.demo   |
| Professor     | marcos@sigem.demo   |
| Aluno         | beatriz@sigem.demo  |
| Aluno         | carlos@sigem.demo   |
| Aluno         | daniela@sigem.demo  |
| Aluno         | eduardo@sigem.demo  |
| Aluno         | fernanda@sigem.demo |

### Comandos úteis

Rode os comandos do banco na raiz do projeto e os do servidor na pasta `backend/`.

| Comando                  | O que faz                                                |
|--------------------------|----------------------------------------------------------|
| `docker compose up -d`   | Liga o banco                                             |
| `docker compose down`    | Desliga o banco e mantém os dados                        |
| `docker compose down -v` | Apaga o banco inteiro; na próxima subida ele é recriado vazio |
| `npm run dev`            | Inicia o servidor em modo de desenvolvimento             |
| `npm run dados-demo`     | Carrega a escola de demonstração (só com o banco vazio)  |
| `npm run criar-admin`    | Cria um usuário administrador                            |

### Problemas comuns

- **"Falha ao conectar no banco":** confira se o Docker Desktop está aberto e
  rode `docker compose up -d`.
- **`EADDRINUSE` (porta 3000 em uso):** já existe outro servidor do SIGEM
  rodando. Feche o terminal antigo ou aperte `Ctrl + C` nele.

## Estrutura do projeto

```
SIGEM-TE/
├── docker-compose.yml     -> banco PostgreSQL em Docker
├── backend/
│   ├── src/
│   │   ├── config/        -> conexão com o banco, schema.sql e migrações
│   │   ├── controllers/   -> lógica de cada funcionalidade
│   │   ├── middlewares/   -> autenticação, limite de tentativas e upload
│   │   ├── routes/        -> rotas da API (/api/...)
│   │   ├── scripts/       -> criar-admin, dados-demo, testar-smtp
│   │   ├── utils/         -> validação, e-mail e notificações
│   │   └── server.js      -> arquivo principal do backend
│   ├── package.json
│   └── .env.example       -> modelo das configurações
└── frontend/              -> telas em HTML, CSS e JavaScript
```

Mais detalhes sobre como as partes se conectam estão em `ARQUITETURA.md`, e o
histórico de versões está em `CHANGELOG.md`.
