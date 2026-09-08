# --- 1. asama: arayuzu derle ------------------------------------------------
FROM node:24-alpine AS client-build

WORKDIR /build

COPY client/package.json client/package-lock.json* ./
RUN npm install

COPY client/ ./
RUN npm run build

# --- 2. asama: calisma imaji ------------------------------------------------
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Sunucu bagimliliklari (SQLite icin Node'un yerlesik node:sqlite modulu
# kullanildigindan derlenmesi gereken native paket yoktur).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY --from=client-build /build/dist ./client/dist

# Veritabani dosyasi burada tutulur (compose'da kalici volume baglanir).
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3001
CMD ["node", "server/index.js"]
