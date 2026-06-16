# Stage 1: React build
FROM node:20-alpine AS frontend
WORKDIR /build
COPY budgetviewreact/package*.json ./
RUN npm ci
COPY package.json /package.json
COPY budgetviewreact/ ./
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app
COPY budgetapi/package*.json ./
RUN npm ci --omit=dev
COPY budgetapi/ ./
COPY --from=frontend /build/dist ./public
EXPOSE 5000
CMD ["node", "app.js"]
