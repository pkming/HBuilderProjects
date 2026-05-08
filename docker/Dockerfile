FROM node:20-slim

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend /app/backend
COPY frontend /app/frontend

ENV NODE_ENV=production \
    PORT=3100

EXPOSE 3100

CMD ["node", "backend/src/server.js"]
