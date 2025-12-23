# Constellation Strapi Dockerfile

# ----- Builder -----
FROM node:20-slim AS builder
WORKDIR /srv/app

ENV NODE_ENV=production

# Native build tools for better-sqlite3 & node-gyp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build admin
COPY . .
RUN npm run build

# ----- Runner -----
FROM node:20-slim AS runner
WORKDIR /srv/app

ENV NODE_ENV=production \
    PORT=1337

# Copy application and deps from builder
COPY --from=builder /srv/app /srv/app

# Remove dev dependencies for smaller runtime image
RUN npm prune --omit=dev

# Expose Strapi default port
EXPOSE 1337

# Persist SQLite DB if using default
VOLUME ["/srv/app/.tmp"]

CMD ["npm", "run", "start"]
