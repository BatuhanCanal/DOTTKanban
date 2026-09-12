'use strict';

/**
 * Giris denemeleri icin basit hiz siniri (kaba kuvvet saldirisina karsi).
 *
 * Companion parola dogrulamasini Planka'ya devrediyor; yani sinirsiz deneme
 * hakki verirsek Planka'nin onunde acik bir parola deneme kapisi birakmis
 * oluruz. Burada sayaci kendimiz tutuyoruz.
 *
 * Iki ayri kova var:
 *   - kullanici+IP : belirli bir hesabi denemeyi zorlastirir (siki sinir),
 *   - IP           : ayni yerden coklu hesap taramasini zorlastirir (genis sinir).
 *
 * Sayac bellekte tutulur: servis yeniden baslayinca sifirlanir. Tek konteynerli
 * bu kurulum icin yeterli; Redis gibi bir bagimlilik eklemeye degmez.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 dakikalik pencere
const MAX_PER_USER_IP = 5; // ayni hesap + ayni IP icin basarisiz deneme
const MAX_PER_IP = 30; // ayni IP icin toplam basarisiz deneme
const MAX_KEYS = 5000; // bellek tavani

const buckets = new Map(); // key -> { count, resetAt }

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function peek(key, now) {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    return null;
  }

  return bucket;
}

/** Basarisiz denemeyi sayar. */
function record(key, now) {
  const bucket = peek(key, now);

  if (bucket) {
    bucket.count += 1;
    return;
  }

  if (buckets.size >= MAX_KEYS) {
    prune(now);

    if (buckets.size >= MAX_KEYS) {
      buckets.delete(buckets.keys().next().value);
    }
  }

  buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
}

const keysFor = (ip, username) => ({
  userIp: `u:${String(username).toLowerCase()}|${ip}`,
  ip: `i:${ip}`,
});

/**
 * Deneme hakki kalmis mi? Kalmadiysa {retryAfterSeconds} doner.
 * Sayac artmaz - yalnizca basarisiz denemeler sayilir (bkz. recordFailure).
 */
function check(ip, username) {
  const now = Date.now();
  const keys = keysFor(ip, username);

  const userIpBucket = peek(keys.userIp, now);
  const ipBucket = peek(keys.ip, now);

  const blocked =
    (userIpBucket && userIpBucket.count >= MAX_PER_USER_IP) ||
    (ipBucket && ipBucket.count >= MAX_PER_IP);

  if (!blocked) {
    return null;
  }

  const resetAt = Math.max(userIpBucket ? userIpBucket.resetAt : 0, ipBucket ? ipBucket.resetAt : 0);

  return { retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

function recordFailure(ip, username) {
  const now = Date.now();
  const keys = keysFor(ip, username);

  record(keys.userIp, now);
  record(keys.ip, now);
}

/** Giris basarili olunca o hesabin sayaci silinir (IP sayaci kalir). */
function recordSuccess(ip, username) {
  buckets.delete(keysFor(ip, username).userIp);
}

module.exports = { check, recordFailure, recordSuccess, WINDOW_MS, MAX_PER_USER_IP, MAX_PER_IP };
