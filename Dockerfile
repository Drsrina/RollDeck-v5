# ==========================================
# Multi-stage Dockerfile para RollDeck v5
# ==========================================

# Stage 1: Compilação do Frontend SPA
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependências completas para o build
COPY package*.json ./
RUN npm ci

# Copiar código fonte
COPY tsconfig*.json vite.config.ts index.html ./
COPY src/ ./src/
COPY public/ ./public/
COPY server/ ./server/
COPY server.ts ./

# Executar build de produção do Vite PWA
RUN npm run build

# ==========================================
# Stage 2: Imagem Final de Execução
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Instalar dependências necessárias para a API REST e servidor
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copiar arquivos de build do Stage 1
COPY --from=builder /app/dist ./dist

# Copiar servidor backend e seus módulos
COPY server.ts ./
COPY server/ ./server/
COPY src/data/ ./src/data/
COPY src/lib/ ./src/lib/
COPY src/types/ ./src/types/

# Copiar bundle estático do Watabou City Generator
COPY .fmg-bundle/.1implementacoes/TownGeneratorOS/Export/html5/bin ./.fmg-bundle/.1implementacoes/TownGeneratorOS/Export/html5/bin

# Criar diretório de dados persistentes para a API Store
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["tsx", "server.ts"]
