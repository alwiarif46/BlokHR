# Build from monorepo root:
#   docker build -f services/gateway/Dockerfile .
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY services/gateway/package.json services/gateway/package-lock.json ./services/gateway/
RUN cd services/gateway && npm ci
COPY services/gateway ./services/gateway
COPY frontend ./frontend
RUN cd services/gateway && npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV FRONTEND_DIR=/app/frontend
COPY --from=build /app/services/gateway/package.json /app/services/gateway/package-lock.json ./services/gateway/
COPY --from=build /app/services/gateway/node_modules ./services/gateway/node_modules
COPY --from=build /app/services/gateway/dist ./services/gateway/dist
COPY --from=build /app/frontend ./frontend
WORKDIR /app/services/gateway
EXPOSE 8080
CMD ["node", "dist/server.js"]
