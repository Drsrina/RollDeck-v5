FROM node:24-alpine

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
COPY patches/ ./patches/

RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npx", "vite", "dev", "--host", "0.0.0.0", "--port", "5173"]
