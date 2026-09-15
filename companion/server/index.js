'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { registerAuthRoutes } = require('./auth');
const { errorHandler } = require('./http');

const app = express();

app.disable('x-powered-by');

// Ters vekil arkasindaysa gercek istemci IP'si X-Forwarded-For'dan okunur.
// Giris hiz siniri (server/rate-limit.js) dogru calissin diye gerekli.
if (config.trustProxy > 0) {
  app.set('trust proxy', config.trustProxy);
}

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (req, res) => {
  res.json({ plankaUrl: config.plankaPublicUrl });
});

registerAuthRoutes(app);
require('./routes/hub')(app);
require('./routes/boards')(app);
require('./routes/templates')(app);
require('./routes/label-groups')(app);
require('./routes/zaman-cizelgesi')(app);

// --- Arayuz (Vite ile derlenmis React uygulamasi) --------------------------
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));

  // SPA: /api ile baslamayan tum GET istekleri index.html'e duser.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(indexHtml);
  });
} else {
  console.warn('[companion] client/dist bulunamadi - once "npm run build" calistirin.');
}

app.use((req, res) => {
  res.status(404).json({ error: 'Bulunamadi.' });
});

app.use(errorHandler);

// --- Acilista yapilandirma kontrolu ---------------------------------------
// Yayina alirken en sik atlanan iki ayar; sessizce gecmek yerine uyariyoruz.
function warnAboutConfig() {
  const isHttps = config.plankaPublicUrl.startsWith('https://');

  if (isHttps && !config.cookieSecure) {
    console.warn(
      '[companion] UYARI: adres https ama COOKIE_SECURE=false. Oturum cerezi sifrelenmemis\n' +
        '            baglantida da gonderilir. .env icinde COMPANION_COOKIE_SECURE=true yapin.',
    );
  }

  if (isHttps && config.trustProxy === 0) {
    console.warn(
      '[companion] UYARI: https arkasinda ama TRUST_PROXY ayarlanmamis. Giris hiz siniri\n' +
        '            tum kullanicilari tek IP sayar. Tek bir ters vekil varsa TRUST_PROXY=1 yapin.',
    );
  }
}

app.listen(config.port, () => {
  console.log(`[companion] http://localhost:${config.port} adresinde calisiyor`);
  console.log(`[companion] Planka API: ${config.plankaInternalUrl}`);
  warnAboutConfig();
});
