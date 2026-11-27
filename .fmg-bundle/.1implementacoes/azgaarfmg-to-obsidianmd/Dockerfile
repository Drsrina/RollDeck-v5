FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
RUN npm run build

COPY entrypoint.js ./

VOLUME ["/data/input", "/data/vault"]

ENV INPUT_DIR=/data/input
ENV VAULT_DIR=/data/vault
ENV WATCH=false

ENTRYPOINT ["node", "entrypoint.js"]
