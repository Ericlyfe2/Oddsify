# Backend image for the Oddsify API (Koyeb / any container host).
#
# The repo is an npm workspaces monorepo; only the `server` workspace is
# installed here. The client is built and served separately by Vercel.

# ---- deps ---------------------------------------------------------------
# bcrypt is a native module. Prebuilt binaries cover linux/glibc x64, but the
# toolchain is kept here so the build still succeeds if it has to compile.
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Workspace manifests must all be present for `npm ci` to validate the lockfile.
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --omit=dev --workspace server

# ---- runtime ------------------------------------------------------------
FROM node:20-slim AS runtime
ENV NODE_ENV=production
# Koyeb routes to 8000 by default; config/env.js reads PORT.
ENV PORT=8000
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server

# Drop privileges — the `node` user ships with the base image.
USER node

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
