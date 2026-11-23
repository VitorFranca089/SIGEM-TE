# Como rodar o SIGEM (com Docker)

O banco PostgreSQL roda só dentro do Docker, sem nada instalado na máquina.
Pré-requisitos: **Docker Desktop** aberto e **Node.js** instalado.

## Ligar o sistema

1. Abra o Docker Desktop e espere ele iniciar.
2. Na pasta `sigem/`, ligue o banco:
   ```bash
   docker compose up -d
   ```
3. Em seguida, ligue o servidor:
   ```bash
   cd backend
   npm run dev
   ```
4. Abra no navegador: **http://localhost:3000/**

Para desligar o servidor, aperte `Ctrl + C` no terminal dele.

## Logins de demonstração

A senha é a mesma para todos: **`Banca@2026`**

| Perfil    | E-mail               | Nome                |
|-----------|----------------------|---------------------|
| Admin     | admin@sigem.demo     | Administração SIGEM |
| Professor | helena@sigem.demo    | Helena Duarte       |
| Professor | marcos@sigem.demo    | Marcos Teixeira     |
| Aluno     | beatriz@sigem.demo   | Beatriz Lima        |
| Aluno     | carlos@sigem.demo    | Carlos Souza        |
| Aluno     | daniela@sigem.demo   | Daniela Rocha       |
| Aluno     | eduardo@sigem.demo   | Eduardo Alves       |
| Aluno     | fernanda@sigem.demo  | Fernanda Costa      |

## Comandos do banco (rodar na pasta `sigem/`)

| Comando                   | O que faz                                    |
|---------------------------|----------------------------------------------|
| `docker compose up -d`    | Liga o banco                                 |
| `docker compose down`     | Desliga o banco e **mantém** os dados        |
| `docker compose down -v`  | **APAGA** o banco inteiro (recomeça do zero) |
| `docker ps`               | Mostra se o container `sigem-postgres` está ligado |

## Recomeçar do zero com os dados de demonstração

```bash
docker compose down -v
docker compose up -d
cd backend
npm run dados-demo
```

Antes de rodar o `npm run dados-demo`, espere uns 10 segundos para o banco
terminar de criar as tabelas. O script só funciona com o banco vazio.

## Dados de conexão do banco (caso precise)

- Host: `127.0.0.1` · Porta: `5433` (não é a 5432 padrão, para não conflitar com outros projetos)
- Banco: `sigem_db` · Usuário: `postgres` · Senha: `sigem_dev_123`
- Container: `sigem-postgres` · Configuração em `docker-compose.yml` e `backend/.env`

## Se der problema

- **"Falha ao conectar no banco"**: o Docker Desktop está aberto? Rode `docker compose up -d`.
- **Erro `EADDRINUSE` (porta 3000 em uso)**: já tem outro servidor do SIGEM aberto.
  Feche o terminal antigo ou reinicie o computador.
