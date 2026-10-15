FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/llm-providers/package.json ./packages/llm-providers/package.json
RUN npm ci --workspace @aiinference/api --include-workspace-root=false

COPY . .

RUN npx prisma generate --schema apps/api/prisma/schema.prisma

EXPOSE 4000

CMD ["sh", "-c", "npm run prisma:migrate:deploy --workspace @aiinference/api && npm run dev --workspace @aiinference/api"]
