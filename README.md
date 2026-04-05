# HsumChaint Node API

A RESTful API for the HsumChaint platform built with **Express**, **Bun**, **Prisma**, and **MySQL**.

🔗 **Production API:** https://hsum-chaint-node-api.invisigate.asia

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| [Bun](https://bun.sh) | JavaScript runtime & package manager |
| [Express](https://expressjs.com) v5 | Web framework |
| [Prisma](https://prisma.io) v7 | ORM & database migrations |
| [MySQL](https://www.mysql.com) 8.0 | Database |
| [Redis](https://redis.io) | Caching & session management |
| [Zod](https://zod.dev) | Request validation |
| [Pino](https://getpino.io) | Structured logging |
| [Docker](https://www.docker.com) | Containerization |

---

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.10
- [Docker](https://www.docker.com/products/docker-desktop) & Docker Compose
- MySQL 8.0 (or use Docker)

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/one-project-one-month/HsumChaint_Node.git
cd HsumChaint_Node
bun install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# App
NODE_ENV=development
PORT=3000

# Database
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=myapp_dev
MYSQL_USER=appuser
MYSQL_PASSWORD=apppassword
DATABASE_URL=mysql://appuser:apppassword@mysql:3306/myapp_dev

# Redis
REDIS_PASSWORD=redispassword
REDIS_URL=redis://:redispassword@redis:6379

# JWT
JWT_ACCESS_TOKEN_SECRET=your-secret
JWT_ACCESS_TOKEN_EXPIRES_IN=7d
JWT_REFRESH_TOKEN_SECRET=your-refresh-secret

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Rate Limit
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### 3. Generate Prisma Client

```bash
DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy" bunx prisma generate
```

### 4. Run with Docker (Recommended)

```bash
# Start all services (app + mysql + redis)
bun run docker:dev

# Or manually:
docker-compose -f docker-compose-development.yml --env-file .env up -d
```

This starts:
- **App** → http://localhost:3000 (with hot-reload)
- **MySQL** → localhost:3306
- **Redis** → localhost:6379

#### With Dev Tools (Prisma Studio + Redis Commander)

```bash
docker-compose -f docker-compose-development.yml --env-file .env --profile dev up -d
```

- **Prisma Studio** → http://localhost:5555
- **Redis Commander** → http://localhost:8081

### 5. Run Without Docker

> Requires MySQL and Redis running locally.

```bash
# Run database migrations
bun run db:migrate

# Start dev server (with watch mode)
bun run dev
```

### 6. Stop Services

```bash
# Stop containers
bun run docker:down

# Stop and remove volumes (wipe DB data)
docker-compose -f docker-compose-development.yml --env-file .env down -v
```

---

## API Routes

**Base URL:** `http://localhost:3000` (local) | `https://hsum-chaint-node-api.invisigate.asia` (production)

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |

### Authentication — `/api/v1/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/register` | Register a new user | ❌ |
| `POST` | `/api/v1/auth/login` | Login | ❌ |
| `POST` | `/api/v1/auth/refresh-token` | Refresh access token | ❌ |
| `POST` | `/api/v1/auth/logout` | Logout | ❌ |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset | ❌ |
| `POST` | `/api/v1/auth/reset-password` | Reset password with token | ❌ |

#### Register — `POST /api/v1/auth/register`

```json
{
  "phone": "09xxxxxxxxx",
  "username": "string (min 3 chars)",
  "password": "string (min 6 chars)",
  "userType": "Monk | Donor",
  "email": "optional",
  "contactPhone": "optional",
  "fcmToken": "optional",
  "monasteryName": "required if Monk",
  "monasteryAddress": "required if Monk"
}
```

#### Login — `POST /api/v1/auth/login`

```json
{
  "phone": "09xxxxxxxxx",
  "password": "string"
}
```

#### Refresh Token — `POST /api/v1/auth/refresh-token`

```json
{
  "refreshToken": "string (or via cookie)"
}
```

#### Forgot Password — `POST /api/v1/auth/forgot-password`

```json
{
  "phone": "09xxxxxxxxx"
}
```

#### Reset Password — `POST /api/v1/auth/reset-password`

```json
{
  "resetToken": "string",
  "password": "string (min 6 chars)"
}
```

### Users — `/api/v1/users`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/users` | Get all users | ❌ |
| `GET` | `/api/v1/users/me` | Get current user | ✅ |
| `GET` | `/api/v1/users/:id` | Get user by ID | ❌ |
| `POST` | `/api/v1/users` | Create a user | ❌ |
| `DELETE` | `/api/v1/users/:id` | Delete a user | ❌ |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stats` | Swagger Stats dashboard |
| `GET` | `/api-docs` | Swagger API documentation |

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start dev server with watch mode |
| `bun run build` | Build compiled binary |
| `bun run start` | Run compiled binary |
| `bun run db:migrate` | Run Prisma migrations (dev) |
| `bun run db:migrate:prod` | Deploy Prisma migrations (prod) |
| `bun run db:seed` | Seed database |
| `bun run db:studio` | Open Prisma Studio |
| `bun test` | Run tests |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun run check` | Lint + Format with Biome |
| `bun run docker:dev` | Start Docker (development) |
| `bun run docker:down` | Stop Docker (development) |

---

## Project Structure

```
src/
├── config/
│   ├── env.ts              # Environment validation (Zod)
│   └── swagger.ts          # Swagger/OpenAPI config
├── lib/
│   ├── prisma.ts           # Prisma client instance
│   └── redis.ts            # Redis client instance
├── middlewares/
│   ├── authMiddleWare.ts   # JWT auth middleware
│   ├── errorHandler.ts     # Global error handler
│   ├── httpLogger.ts       # HTTP request logger (Pino)
│   └── validator.ts        # Zod validation middleware
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.schema.ts
│   │   └── auth.service.ts
│   └── user/
│       ├── user.controller.ts
│       ├── user.routes.ts
│       └── user.service.ts
├── utils/
│   ├── logger.ts           # Pino logger
│   └── response.ts         # Standardized API responses
├── app.ts                  # Express app setup
└── index.ts                # Server entry point
```

---

## Deployment

Deployment is automated via GitHub Actions on push to `main` or `develop`.

| Branch | Environment | URL |
|--------|-------------|-----|
| `develop` | Development | https://hsum-chaint-node-api.invisigate.asia |
| `main` | Production | https://hsum-chaint-node-api.invisigate.asia |

### CI/CD Pipeline

1. **Build** — Docker image built and pushed to GHCR
2. **Deploy** — SSH to DigitalOcean, pull image, run containers
3. **Migrate** — Prisma migrations applied automatically
4. **Notify** — Telegram notification on success/failure

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DO_HOST` | DigitalOcean server IP |
| `DO_USER` | SSH username |
| `DO_SSH_KEY` | SSH private key |
| `DO_SSH_PASSPHRASE` | SSH key passphrase |
| `MYSQL_ROOT_PASSWORD` | MySQL root password |
| `MYSQL_USER` | MySQL app user |
| `MYSQL_PASSWORD` | MySQL app user password |
| `REDIS_PASSWORD` | Redis password |
| `JWT_ACCESS_TOKEN_SECRET` | JWT access token secret |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | JWT access token expiry |
| `JWT_REFRESH_TOKEN_SECRET` | JWT refresh token secret |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | JWT refresh token expiry |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | Telegram chat ID |
| `TELEGRAM_GITHUB_TOPIC_ID` | Telegram topic thread ID |

### Required GitHub Variables

| Variable | Description |
|----------|-------------|
| `DB_NAME` | Database name |

---

## Git Conventions

### Branch Naming

```
feat/feature-name
fix/bug-name
chore/task-name
hotfix/critical-fix
```

### Commit Messages

Follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user profile endpoint
fix: resolve auth token expiry issue
chore: update dependencies
docs: update README
```

### Git Hooks (Lefthook)

| Hook | Action |
|------|--------|
| `pre-commit` | Biome lint & format |
| `commit-msg` | Commitlint validation |
| `pre-push` | Branch name check + unit tests |
