'use strict';

const planka = require('./planka');
const { clearTokenCookie } = require('./auth');

/** async route handler'larda olusan hatalari Express'in hata zincirine aktarir. */
const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

/** Planka'dan gelen hatalari anlamli HTTP cevaplarina cevirir. */
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof planka.PlankaError) {
    if (error.status === 401) {
      clearTokenCookie(res);
      res.status(401).json({ error: 'Oturum suresi doldu, tekrar giris yapin.' });
      return;
    }

    if (error.status === 403) {
      res.status(403).json({ error: 'Bu islem icin Planka uzerinde yetkiniz yok.' });
      return;
    }

    if (error.status === 404) {
      res.status(404).json({ error: 'Planka uzerinde bulunamadi (silinmis olabilir).' });
      return;
    }

    res.status(error.status >= 500 ? 502 : error.status).json({
      error: `Planka hatasi: ${error.message}`,
    });
    return;
  }

  console.error('[companion] beklenmeyen hata:', error);
  res.status(500).json({ error: 'Sunucu hatasi.' });
}

module.exports = { asyncRoute, errorHandler };
