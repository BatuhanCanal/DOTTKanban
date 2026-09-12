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

  // Ters vekil (nginx, Traefik, Caddy...) arkasinda calisiyorsa: kac vekil var?
  // Bu ayarlanmazsa her istek vekilin IP'sinden geliyormus gibi gorunur ve giris
  // hiz siniri herkesi ayni kovaya koyar. Tek bir nginx varsa 1 yazin.
  trustProxy: Number(process.env.TRUST_PROXY || 0),

  cookieName: 'dott_token',
};
