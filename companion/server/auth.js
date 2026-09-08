'use strict';

/**
 * Kimlik dogrulama.
 *
 * Companion'in KENDI kullanici sistemi yoktur. Kullanici buraya kendi Planka
 * hesabiyla girer; aldigimiz Planka token'ini httpOnly bir cerezde tutar ve tum
 * API cagrilarini o kullanici adina yapariz. Boylece:
 *   - yetkiler birebir Planka'daki yetkilerdir (ayrica yonetmemiz gerekmez),
 *   - yapilan degisiklikler Planka'nin gecmisinde dogru kisiye yazilir,
 *   - companion hicbir yerde yonetici sifresi saklamaz.
 */

const config = require('./config');
const planka = require('./planka');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax', // siteler arasi POST isteklerini (CSRF) engeller
  secure: config.cookieSecure,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 gun
};

function setTokenCookie(res, token) {
  res.cookie(config.cookieName, token, COOKIE_OPTIONS);
}

function clearTokenCookie(res) {
  res.clearCookie(config.cookieName, { ...COOKIE_OPTIONS, maxAge: undefined });
}

/** Korumali uclar icin: cerezdeki Planka token'ini req.plankaToken'a koyar. */
function requireAuth(req, res, next) {
  const token = req.cookies[config.cookieName];

  if (!token) {
    res.status(401).json({ error: 'Giris yapmaniz gerekiyor.' });
    return;
  }

  req.plankaToken = token;
  next();
}

function registerAuthRoutes(app) {
  app.post('/api/auth/login', async (req, res, next) => {
    const { emailOrUsername, password } = req.body || {};

    if (!emailOrUsername || !password) {
      res.status(400).json({ error: 'Kullanici adi ve sifre gerekli.' });
      return;
    }

    try {
      const token = await planka.login(emailOrUsername, password);
      const me = await planka.getMe(token);

      setTokenCookie(res, token);
      res.json({ user: me.item });
    } catch (error) {
      if (error instanceof planka.TermsAcceptanceRequiredError) {
        res.status(403).json({
          error: 'terms_required',
          message:
            'Bu hesap Planka\'ya ilk kez giriyor. Once Planka\'yi acip kullanim sartlarini kabul edin, sonra buraya donun.',
          plankaUrl: config.plankaPublicUrl,
        });
        return;
      }

      if (error instanceof planka.PlankaError && error.status === 401) {
        res.status(401).json({ error: 'Kullanici adi veya sifre hatali.' });
        return;
      }

      next(error);
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearTokenCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, async (req, res, next) => {
    try {
      const me = await planka.getMe(req.plankaToken);
      res.json({ user: me.item, plankaUrl: config.plankaPublicUrl });
    } catch (error) {
      if (error instanceof planka.PlankaError && error.status === 401) {
        clearTokenCookie(res);
        res.status(401).json({ error: 'Oturum suresi doldu, tekrar giris yapin.' });
        return;
      }

      next(error);
    }
  });
}

module.exports = { requireAuth, registerAuthRoutes, clearTokenCookie };
