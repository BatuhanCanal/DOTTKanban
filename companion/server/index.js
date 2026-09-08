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

app.listen(config.port, () => {
  console.log(`[companion] http://localhost:${config.port} adresinde calisiyor`);
  console.log(`[companion] Planka API: ${config.plankaInternalUrl}`);
});
