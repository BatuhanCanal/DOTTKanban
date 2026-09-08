'use strict';

/**
 * Board goruntuleme ve kart tasima uclari.
 *
 * Onemli: burada hicbir kart/liste verisi saklanmaz. Her istek Planka'dan taze
 * veriyi ceker, degisiklikler de dogrudan Planka'ya yazilir.
 */

const planka = require('../planka');
const { requireAuth } = require('../auth');
const { asyncRoute } = require('../http');
const { normalizeBoard } = require('../board-data');

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
      res.json(normalizeBoard(response));
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
};
