FROM node:20-alpine

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

CMD ["node", "backend/src/server.js"]
