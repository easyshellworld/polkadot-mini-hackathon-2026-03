# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Accept VITE_ build-args so they are baked into the JS bundle
ARG VITE_API_BASE_URL
ARG VITE_RPC_URL
ARG VITE_CONTRACT_ADDRESS
ARG VITE_TOURNAMENT_ADDRESS
ARG VITE_ARENA_ADDRESS
ARG VITE_USE_TESTNET

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_RPC_URL=$VITE_RPC_URL \
    VITE_CONTRACT_ADDRESS=$VITE_CONTRACT_ADDRESS \
    VITE_TOURNAMENT_ADDRESS=$VITE_TOURNAMENT_ADDRESS \
    VITE_ARENA_ADDRESS=$VITE_ARENA_ADDRESS \
    VITE_USE_TESTNET=$VITE_USE_TESTNET

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
