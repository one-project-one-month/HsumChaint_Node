FROM oven/bun:1.3.10

WORKDIR /app

COPY package.json bun.lock* ./
COPY prisma ./prisma/

RUN apt-get update && apt-get install -y curl && \
    bun install && \
    bunx prisma generate

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "until bunx prisma db push; do echo 'Waiting for database...'; sleep 2; done && bun run dev"]