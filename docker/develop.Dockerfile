# Stage 1: Build stage
FROM oven/bun:1.3.10 AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bunx prisma generate
RUN bun run build

# Stage 2: Run stage
FROM debian:bookworm-slim AS runner
WORKDIR /app

RUN useradd -ms /bin/bash bunuser
USER bunuser

COPY --from=builder /app/dist/hsumchaint ./hsumchaint
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["./hsumchaint"]