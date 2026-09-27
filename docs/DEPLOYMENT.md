# 🚀 Guia Completo de Deploy — Synapse

Este guia aborda todas as opções para colocar o **Synapse** em produção, desde a hospedagem estática global no **Cloudflare Pages** até o self-hosting em **VPS própria ou Docker**.

---

## 📑 Sumário
1. [Arquitetura de Hospedagem](#1-arquitetura-de-hospedagem)
2. [Deploy no Cloudflare Pages (Recomendado para o Frontend)](#2-deploy-no-cloudflare-pages-recomendado-para-o-frontend)
3. [Configurando o Domínio Personalizado (synapse.marksvb.dev)](#3-configurando-o-domínio-personalizado-synapsemarksvbdev)
4. [Deploy do Servidor de Sinalização (WebSockets)](#4-deploy-do-servidor-de-sinalização-websockets)
5. [Deploy Tudo-em-Um via Docker / VPS](#5-deploy-tudo-em-um-via-docker--vps)
6. [Variáveis de Ambiente](#6-variáveis-de-ambiente)

---

## 1. Arquitetura de Hospedagem

O Synapse é composto por duas partes:
- **Frontend SPA (PWA):** Construído com React 18, Vite e Tailwind CSS. Pode ser servido como arquivos estáticos globais em qualquer CDN (Cloudflare Pages, Vercel, Netlify).
- **Servidor de Sinalização (`server.js`):** Processo leve em Node.js com biblioteca `ws` para negociação SDP e ICE. Não trafega mídia, exigindo pouquíssima CPU e memória (< 50MB RAM).

---

## 2. Deploy no Cloudflare Pages (Recomendado para o Frontend)

### Método A: Deploy Automático via GitHub Actions (Já configurado)
O repositório já inclui o arquivo [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

1. Vá em seu repositório no GitHub -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Adicione os seguintes Secrets:
   - `CLOUDFLARE_API_TOKEN`: Token de API da Cloudflare com permissão `Cloudflare Pages: Edit`.
   - `CLOUDFLARE_ACCOUNT_ID`: ID da sua conta Cloudflare (disponível na URL do dashboard ou na barra lateral).
3. A cada `git push` na branch `main`, o GitHub Actions compila o bundle e envia os arquivos em `dist/` automaticamente para a Cloudflare.

### Método B: Conectar o Repositório pelo Dashboard da Cloudflare
1. Acesse o **[Cloudflare Dashboard](https://dash.cloudflare.com/)** -> **Workers & Pages**.
2. Clique em **Create Application** -> **Pages** -> **Connect to Git**.
3. Selecione o repositório `synapse-screen-share`.
4. Defina as configurações de Build:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** `20` (em Environment Variables: `NODE_VERSION = 20`)
5. Clique em **Save and Deploy**.

---

## 3. Configurando o Domínio Personalizado (`synapse.marksvb.dev`)

1. No dashboard do seu projeto no Cloudflare Pages, acesse a aba **Custom domains**.
2. Clique em **Set up a custom domain**.
3. Digite:
   ```
   synapse.marksvb.dev
   ```
4. Clique em **Continue** e confirme.
5. A Cloudflare criará automaticamente a entrada DNS (CNAME) e ativará o certificado HTTPS/SSL com HTTP/3 e aceleração de borda.

---

## 4. Deploy do Servidor de Sinalização (WebSockets)

O servidor de sinalização WebSocket pode ser hospedado gratuitamente ou a baixo custo em qualquer plataforma Node.js com suporte a WebSockets:

### Opção A: Render.com (Gratuito)
1. Crie uma conta no [Render.com](https://render.com/).
2. Clique em **New** -> **Web Service** e conecte o repositório.
3. Configure:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. O Render fornecerá uma URL HTTPS/WSS (ex: `wss://synapse-signaling.onrender.com`).
5. No Synapse, basta apontar para essa URL no modal de Configurações ou salvar como padrão!

### Opção B: Railway ou Fly.io
```bash
# Exemplo Fly.io
fly launch
fly deploy
```

---

## 5. Deploy Tudo-em-Um via Docker / VPS

Para rodar tudo (Frontend estático + Servidor WebSocket) em uma VPS própria (Ubuntu/Debian) usando o servidor Node.js embutido:

### Dockerfile
Crie um arquivo `Dockerfile` na raiz:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js ./
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

### Rodando o Contêiner:
```bash
docker build -t synapse .
docker run -d -p 3000:3000 --name synapse-app synapse
```

O aplicativo estará rodando em `http://seu-ip:3000` (e o WebSocket em `ws://seu-ip:3000`).

---

## 6. Variáveis de Ambiente

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `PORT` | `3000` | Porta TCP na qual o servidor Express e WebSocket escutam |
| `NODE_ENV` | `development` | `production` otimiza logs e ativa compressão de assets |
| `MAX_PEERS_PER_ROOM` | `8` | Limite máximo de participantes simultâneos por sala |
| `RATE_LIMIT_MAX_MESSAGES` | `60` | Teto de mensagens de sinalização a cada 5 segundos por IP |

---

<div align="center">
<sub>Synapse Deployment Guide // 2026</sub>
</div>
