'use strict';

/**
 * Etiket turleri (kategoriler) uclari.
 *
 * Planka'da etiketler tek bir duz havuzdur; iki ayri eksen (Ekip, Etkinlik
 * Turu) bilmez. Bu uclar sayesinde yoneticiler "tur" tanimlar ve panodaki
 * etiketleri ture baglar. Boylece pano sayfasinda her tur icin ayri bir
 * gorunum sekmesi dogar ("Ekiplere gore", "Etkinlik turune gore"...).
 *
 * Turler herkese aciktir (okumak icin); olusturma/duzenleme/silme yalnizca
 * Planka yoneticisine aciktir.
 */

const db = require('../db');
const { requireAuth, isAdmin } = require('../auth');
const { asyncRoute } = require('../http');
const { normalizeBoard } = require('../board-data');
const planka = require('../planka');

/**
 * Tur listesini herkes okuyabilir; degisiklik yalnizca yoneticiye acik.
 */
function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    res.status(403).json({ error: 'Bu işlem yalnızca yöneticilere açıktır.' });
    return;
  }

  next();
}

module.exports = (app) => {
  // Tum turler + her turun bagli oldugu etiketler (board bazli).
  // Arayuzun pano gorunumu bu veriyi kullanarak dinamik sekmeler uretir.
  app.get(
    '/api/label-groups',
    requireAuth,
    asyncRoute(async (req, res) => {
      const groups = db.listLabelGroups();
      const items = db.listLabelGroupItemsDetailed();

      // Her turun altindaki etiketleri grupla
      const itemsByGroup = new Map();
      for (const item of items) {
        if (!itemsByGroup.has(item.groupId)) {
          itemsByGroup.set(item.groupId, []);
        }
        itemsByGroup.get(item.groupId).push({ boardId: item.boardId, labelId: item.labelId });
      }

      res.json(
        groups.map((group) => ({
          id: group.id,
          name: group.name,
          position: group.position,
          labels: itemsByGroup.get(group.id) || [],
        })),
      );
    }),
  );

  // Yeni tur olustur (admin).
  app.post(
    '/api/label-groups',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { name } = req.body || {};

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({ error: 'Tür adı en az 2 karakter olmali.' });
        return;
      }

      try {
        const group = db.createLabelGroup(name.trim());
        res.status(201).json({ id: group.id, name: group.name, position: group.position });
      } catch (error) {
        // UNIQUE constraint — ayni adla iki tur olamaz
        if (error.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE') {
          res.status(409).json({ error: 'Bu adla bir tür zaten var.' });
          return;
        }
        throw error;
      }
    }),
  );

  // Tur adini degistir (admin).
  app.patch(
    '/api/label-groups/:id',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { name } = req.body || {};

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({ error: 'Tür adı en az 2 karakter olmali.' });
        return;
      }

      const group = db.renameLabelGroup(Number(req.params.id), name.trim());

      if (!group) {
        res.status(404).json({ error: 'Tür bulunamadı.' });
        return;
      }

      res.json({ id: group.id, name: group.name, position: group.position });
    }),
  );

  // Turu sil (admin). Ture bagli etiketler de baglantidan cikar (CASCADE).
  app.delete(
    '/api/label-groups/:id',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const deleted = db.deleteLabelGroup(Number(req.params.id));

      if (!deleted) {
        res.status(404).json({ error: 'Tür bulunamadı.' });
        return;
      }

      res.json({ ok: true });
    }),
  );

  // --- Tur icindeki etiketler -----------------------------------------------

  // Panodaki etiketleri listeler (admin icin "hangi etiketleri baglayabilirim"
  // listesi). Planka'dan ceker, zira etiketler orada yasar.
  app.get(
    '/api/boards/:boardId/labels',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const response = await planka.getBoard(req.plankaToken, req.params.boardId);
      const board = normalizeBoard(response);

      res.json(board.labels);
    }),
  );

  // Bir etiketi ture bagla (admin).
  app.post(
    '/api/label-groups/:id/labels',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { boardId, labelId } = req.body || {};

      if (!boardId || !labelId) {
        res.status(400).json({ error: 'boardId ve labelId gerekli.' });
        return;
      }

      // Etiketin bu panoda var oldugunu dogrula (uyurma bir ID baglanmasin).
      const response = await planka.getBoard(req.plankaToken, boardId);
      const board = normalizeBoard(response);
      const labelExists = board.labels.some((label) => label.id === labelId);

      if (!labelExists) {
        res.status(404).json({ error: 'Etiket bu panoda bulunamadı.' });
        return;
      }

      const added = db.addLabelToGroup(Number(req.params.id), boardId, labelId);

      res.status(added ? 201 : 200).json({ ok: true });
    }),
  );

  // Bir etiketi turden cikar (admin).
  app.delete(
    '/api/label-groups/:id/labels/:boardId/:labelId',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const removed = db.removeLabelFromGroup(
        Number(req.params.id),
        req.params.boardId,
        req.params.labelId,
      );

      if (!removed) {
        res.status(404).json({ error: 'Etiket bu türde bulunamadı.' });
        return;
      }

      res.json({ ok: true });
    }),
  );
};
