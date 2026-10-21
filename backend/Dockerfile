# Backend: API REST + ingesta MQTT + temporizador.
# Multi-arquitectura: corre igual en tu PC (x86) y en la VM ARM de Oracle Cloud.

# --- Etapa 1: compilar TypeScript ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Etapa 2: imagen final, solo dependencias de producción + JS compilado ---
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1
CMD ["node", "dist/index.js"]