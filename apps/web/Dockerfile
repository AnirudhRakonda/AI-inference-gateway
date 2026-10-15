FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspace @aiinference/web --include-workspace-root=false

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--workspace", "@aiinference/web"]
