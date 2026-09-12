'use strict';

/**
 * Board goruntuleme ve kart tasima uclari.
 *
 * Onemli: burada hicbir kart/liste verisi saklanmaz. Her istek Planka'dan taze
 * veriyi ceker, degisiklikler de dogrudan Planka'ya yazilir.
 */

const planka = require('../planka');
const db = require('../db');
const { requireAuth } = require('../auth');
const { asyncRoute } = require('../http');
const { normalizeBoard } = require('../board-data');

/** 'YYYY-MM-DD' mi? (Zaman cizelgesi gun hassasiyetinde calisir.) */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDay(value) {
  if (!DAY_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Kullanicinin bu karti gercekten gorebildigini Planka'ya sorar ve karti doner.
 * Companion'in kendi veritabanina kart bazli bir sey yazmadan once sart:
 * yoksa giris yapmis herkes, erisemedigi bir panonun kartina tarih yazabilirdi.
 */
async function findCardOnBoard(token, boardId, cardId) {
  const board = normalizeBoard(await planka.getBoard(token, boardId));

  return board.cards.find((card) => card.id === cardId) || null;
}

/**
 * Bir listeye "index" sirasinda eklenecek kartin pozisyonunu hesaplar.
 * Planka pozisyonlari 65536 araliklarla tuttugu icin iki komsunun ortasi alinir.
 */
function positionAtIndex(sortedPositions, index) {
  if (sortedPositions.length === 0) {
    return planka.POSITION_GAP;
  }

  if (index <= 0) {
    return sortedPositions[0] / 2;
  }

  if (index >= sortedPositions.length) {
    return sortedPositions[sortedPositions.length - 1] + planka.POSITION_GAP;
  }

  return (sortedPositions[index - 1] + sortedPositions[index]) / 2;
}

module.exports = (app) => {
  // Board'un tum verisi: listeler (durum ekseni), etiketler (kategori ekseni) ve kartlar.
  // Eksen degistirmek icin yeniden istek gerekmez; arayuz ayni veriyi farkli gruplar.
  app.get(
    '/api/boards/:boardId',
    requireAuth,
    asyncRoute(async (req, res) => {
      const response = await planka.getBoard(req.plankaToken, req.params.boardId);
      const board = normalizeBoard(response);

      // Baslangic tarihleri Planka'da degil companion'da durur; burada birlestirilir.
      const startDates = db.listCardDates(req.params.boardId);

      board.cards = board.cards.map((card) => ({
        ...card,
        startDate: startDates[card.id] || null,
      }));

      res.json(board);
    }),
  );

  // Kategori ekseninde surukleme: karta etiket ekler.
  app.post(
    '/api/cards/:cardId/labels',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { labelId } = req.body || {};

      if (!labelId) {
        res.status(400).json({ error: 'labelId gerekli.' });
        return;
      }

      try {
        await planka.addCardLabel(req.plankaToken, req.params.cardId, labelId);
      } catch (error) {
        // Etiket zaten karttaysa islem basarili sayilir (surukle-birak tekrarinda olur).
        if (!(error instanceof planka.PlankaError && error.status === 409)) {
          throw error;
        }
      }

      res.json({ ok: true });
    }),
  );

  // Kategori ekseninde surukleme: karttan etiket cikarir.
  app.delete(
    '/api/cards/:cardId/labels/:labelId',
    requireAuth,
    asyncRoute(async (req, res) => {
      try {
        await planka.removeCardLabel(req.plankaToken, req.params.cardId, req.params.labelId);
      } catch (error) {
        if (!(error instanceof planka.PlankaError && error.status === 404)) {
          throw error;
        }
      }

      res.json({ ok: true });
    }),
  );

  // Durum ekseninde surukleme: karti baska listeye/siraya tasir.
  // Pozisyon, cakismalari onlemek icin sunucuda TAZE veri uzerinden hesaplanir.
  app.patch(
    '/api/cards/:cardId/move',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { boardId, listId, index } = req.body || {};

      if (!boardId || !listId || typeof index !== 'number') {
        res.status(400).json({ error: 'boardId, listId ve index gerekli.' });
        return;
      }

      const board = normalizeBoard(await planka.getBoard(req.plankaToken, boardId));

      const positions = board.cards
        .filter((card) => card.listId === listId && card.id !== req.params.cardId)
        .map((card) => card.position ?? 0)
        .sort((a, b) => a - b);

      await planka.updateCard(req.plankaToken, req.params.cardId, {
        listId,
        position: positionAtIndex(positions, index),
      });

      res.json({ ok: true });
    }),
  );

  // --- Zaman cizelgesi tarihleri ------------------------------------------
  // Baslangic tarihi COMPANION'da, bitis tarihi PLANKA'da durur. Ayrim bilincli:
  // bitis tarihi Planka'nin kendi alani (kartta, bildirimlerde, filtrelerde
  // gorunur), baslangic ise Planka'da olmayan bir bilgi.

  app.put(
    '/api/cards/:cardId/start-date',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { boardId, startDate } = req.body || {};

      if (!boardId) {
        res.status(400).json({ error: 'boardId gerekli.' });
        return;
      }

      const card = await findCardOnBoard(req.plankaToken, boardId, req.params.cardId);

      if (!card) {
        res.status(404).json({ error: 'Kart bu panoda bulunamadi.' });
        return;
      }

      // null/bos gonderilmesi "baslangic tarihini kaldir" demektir.
      if (!startDate) {
        db.clearCardStartDate(req.params.cardId);
        res.json({ ok: true, startDate: null });
        return;
      }

      if (!isValidDay(startDate)) {
        res.status(400).json({ error: 'Tarih YYYY-AA-GG biciminde olmali.' });
        return;
      }

      if (card.dueDate && startDate > card.dueDate.slice(0, 10)) {
        res.status(400).json({ error: 'Baslangic tarihi bitis tarihinden sonra olamaz.' });
        return;
      }

      db.setCardStartDate({
        cardId: req.params.cardId,
        boardId,
        startDate,
        updatedBy: req.user.name || req.user.username || null,
        updatedAt: new Date().toISOString(),
      });

      res.json({ ok: true, startDate });
    }),
  );

  // Bitis tarihi Planka'ya yazilir: kullanicinin kendi token'iyla, boylece
  // degisiklik Planka'nin gecmisinde dogru kisiye yazilir.
  app.put(
    '/api/cards/:cardId/due-date',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { dueDate } = req.body || {};

      if (dueDate && !isValidDay(dueDate)) {
        res.status(400).json({ error: 'Tarih YYYY-AA-GG biciminde olmali.' });
        return;
      }

      // Gun ortasi (12:00 UTC) yaziyoruz: hangi saat diliminde okunursa okunsun
      // takvim gunu kaymaz. Planka'nin kendi arayuzunden saat de secilebilir.
      await planka.updateCard(req.plankaToken, req.params.cardId, {
        dueDate: dueDate ? `${dueDate}T12:00:00.000Z` : null,
      });

      res.json({ ok: true });
    }),
  );
};
