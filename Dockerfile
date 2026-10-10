# Multi-stage Docker build for Synapse (Production SPA + WebSockets)
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for building frontend
COPY package*.json ./
RUN npm ci

# Copy project files and build production bundle
COPY . .
RUN npm run build

# Production runtime image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server and compiled assets
COPY server.js ./
COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
