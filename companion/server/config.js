'use strict';

const path = require('path');

const stripTrailingSlash = (value) => (value || '').replace(/\/+$/, '');

module.exports = {
  port: Number(process.env.PORT || 3001),

  // Companion'in Planka API'sine ulasmak icin kullandigi adres.
  // Docker icinde servis adi (http://planka:1337), yerel gelistirmede localhost.
  plankaInternalUrl: stripTrailingSlash(process.env.PLANKA_INTERNAL_URL || 'http://localhost:3000'),

  // Tarayiciya verilecek "Planka'da Ac" linkleri icin disaridan gorunen adres.
  plankaPublicUrl: stripTrailingSlash(
    process.env.PLANKA_PUBLIC_URL || process.env.PLANKA_INTERNAL_URL || 'http://localhost:3000',
  ),

  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'companion.db'),

  // HTTPS arkasinda calisirken true yapin (cerez sadece guvenli baglantida gonderilir).
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  cookieName: 'dott_token',
};
