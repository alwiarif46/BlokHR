# Build from monorepo root:
#   docker build -f backend/Dockerfile .
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY services/billing ./services/billing
COPY services/capture ./services/capture
COPY services/capture-rollcall ./services/capture-rollcall
COPY services/consent ./services/consent
COPY services/directory ./services/directory
COPY services/entitlements ./services/entitlements
COPY services/kiosk ./services/kiosk
COPY services/learning ./services/learning
COPY services/transport ./services/transport
COPY backend ./backend

# Install local package deps first, then monolith (file: links).
RUN for d in billing capture capture-rollcall consent directory entitlements kiosk learning transport; do \
      (cd "services/$d" && npm install --include=dev); \
    done \
 && cd backend && npm install --include=dev

WORKDIR /app/backend
EXPOSE 3000
# Local @blokhr/* packages expose TypeScript entrypoints — run via tsx.
CMD ["npx", "tsx", "src/index.ts"]
