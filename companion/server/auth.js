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
 *
 * Cerezdeki token her istekte Planka'ya DOGRULATILIR. Cerezin varligina guvenmek
 * yetmez: sablon uclari gibi Planka'ya hic gitmeyen uclarda, uydurma bir cerezle
 * gelen (hesabi olmayan) birine kapiyi acardi.
 */

const config = require('./config');
const planka = require('./planka');
const rateLimit = require('./rate-limit');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax', // siteler arasi POST isteklerini (CSRF) engeller
  secure: config.cookieSecure,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 gun
};

// Token dogrulama onbellegi: her istekte Planka'ya gitmemek icin, dogrulanan
// token kisa sure (TOKEN_CACHE_TTL) boyunca burada tutulur. Sure kisa oldugu
// icin Planka'da silinen/degisen bir hesap en fazla bu kadar gecikmeyle duser.
const TOKEN_CACHE_TTL = 60 * 1000;
const TOKEN_CACHE_MAX = 500;
const tokenCache = new Map(); // token -> { user, expiresAt }

function cacheGet(token) {
  const entry = tokenCache.get(token);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    tokenCache.delete(token);
    return null;
  }

  return entry.user;
}

function cacheSet(token, user) {
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    const now = Date.now();

    for (const [key, entry] of tokenCache) {
      if (entry.expiresAt <= now) {
        tokenCache.delete(key);
      }
    }

    // Hala doluysa en eskisini at (Map ekleme sirasini korur).
    if (tokenCache.size >= TOKEN_CACHE_MAX) {
      tokenCache.delete(tokenCache.keys().next().value);
    }
  }

  tokenCache.set(token, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL });
}

function setTokenCookie(res, token) {
  res.cookie(config.cookieName, token, COOKIE_OPTIONS);
}

function clearTokenCookie(res) {
  res.clearCookie(config.cookieName, { ...COOKIE_OPTIONS, maxAge: undefined });
}

/** Planka yoneticisi mi? (Planka surumune gore role ya da isAdmin alani gelir.) */
function isAdmin(user) {
  return Boolean(user && (user.role === 'admin' || user.isAdmin === true));
}

/**
 * Korumali uclar icin: cerezdeki token'i Planka'ya dogrulatir, sonra
 * req.plankaToken ve req.user'i doldurur.
 */
async function requireAuth(req, res, next) {
  const token = req.cookies[config.cookieName];

  if (!token) {
    res.status(401).json({ error: 'Giris yapmaniz gerekiyor.' });
    return;
  }

  const cached = cacheGet(token);

  if (cached) {
    req.plankaToken = token;
    req.user = cached;
    next();
    return;
  }

  try {
    const me = await planka.getMe(token);

    cacheSet(token, me.item);
    req.plankaToken = token;
    req.user = me.item;
    next();
  } catch (error) {
    if (error instanceof planka.PlankaError && (error.status === 401 || error.status === 403)) {
      tokenCache.delete(token);
      clearTokenCookie(res);
      res.status(401).json({ error: 'Oturum suresi doldu, tekrar giris yapin.' });
      return;
    }

    next(error);
  }
}

function registerAuthRoutes(app) {
  app.post('/api/auth/login', async (req, res, next) => {
    const { emailOrUsername, password } = req.body || {};

    if (!emailOrUsername || !password) {
      res.status(400).json({ error: 'Kullanici adi ve sifre gerekli.' });
      return;
    }

    const ip = req.ip || 'bilinmiyor';
    const blocked = rateLimit.check(ip, emailOrUsername);

    if (blocked) {
      const minutes = Math.ceil(blocked.retryAfterSeconds / 60);

      res.set('Retry-After', String(blocked.retryAfterSeconds));
      res.status(429).json({
        error: `Cok fazla hatali deneme yapildi. Yaklasik ${minutes} dakika sonra tekrar deneyin.`,
      });
      return;
    }

    try {
      const token = await planka.login(emailOrUsername, password);
      const me = await planka.getMe(token);

      rateLimit.recordSuccess(ip, emailOrUsername);
      cacheSet(token, me.item);
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
        rateLimit.recordFailure(ip, emailOrUsername);
        res.status(401).json({ error: 'Kullanici adi veya sifre hatali.' });
        return;
      }

      next(error);
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies[config.cookieName];

    if (token) {
      tokenCache.delete(token);
    }

    clearTokenCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({
      user: req.user,
      isAdmin: isAdmin(req.user),
      plankaUrl: config.plankaPublicUrl,
    });
  });
}

module.exports = { requireAuth, registerAuthRoutes, clearTokenCookie, isAdmin };
