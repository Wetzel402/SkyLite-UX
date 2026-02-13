# syntax=docker/dockerfile:1

# Build stage (same structure as root Dockerfile)
FROM --platform=$BUILDPLATFORM dhi.io/node:20-debian13-dev AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN apt-get update -y && apt-get install -y openssl && \
    npm ci && \
    rm -rf /var/lib/apt/lists/*

COPY . .

RUN npx prisma generate
RUN npm run build

FROM dhi.io/node:20-debian13-dev AS production

ARG BUILD_VERSION=dev
ARG TARGETARCH

ENV NODE_ENV=production
ENV HOST=0.0.0.0

WORKDIR /app

COPY prisma ./prisma/
COPY package-lock.json ./package-lock.json

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get install -y hostname openssl jq postgresql postgresql-client gosu && \
    PRISMA_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") && \
    npm install -g prisma@${PRISMA_VERSION} && \
    rm package-lock.json && \
    rm -rf /var/lib/apt/lists/*

ENV LANG=C.UTF-8
ENV LANGUAGE=C.UTF-8
ENV LC_ALL=C.UTF-8

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY ha-app/run.sh /run.sh
RUN chmod +x /run.sh

LABEL io.hass.version="${BUILD_VERSION}" \
      io.hass.type="addon" \
      io.hass.arch="${TARGETARCH}"

EXPOSE 3000

CMD ["/run.sh"]
