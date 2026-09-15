'use strict';

/**
 * Sablon (template) uclari — Planka Community'de olmayan ozellik.
 *
 * "Sablon olarak kaydet": board'un yapisini okuyup companion'in SQLite'ina
 * ID'siz bir anlik goruntu olarak yazar. Planka'ya HICBIR sey yazmaz.
 *
 * "Sablondan olustur": anlik goruntuyu Planka API'sine sirayla create
 * istekleri olarak "geri oynatir"; sonucta tamamen normal bir Planka board'u olusur.
 */

const planka = require('../planka');
const db = require('../db');
const config = require('../config');
const { requireAuth, isAdmin } = require('../auth');
const { asyncRoute } = require('../http');
const { buildSnapshot } = require('../board-data');
const varsayilan = require('../varsayilan-listeler');

const GAP = planka.POSITION_GAP;

const boardUrl = (boardId) => `${config.plankaPublicUrl}/boards/${boardId}`;

/** Yeni board'un proje icindeki pozisyonu: mevcut en buyugun bir sonrasi. */
async function nextBoardPosition(token, projectId) {
  const response = await planka.getProjects(token);

  const positions = ((response.included || {}).boards || [])
    .filter((board) => board.projectId === projectId)
    .map((board) => board.position ?? 0);

  return positions.length === 0 ? GAP : Math.max(...positions) + GAP;
}

/** Anlik goruntudeki yapiyi Planka'da yeniden kurar. */
async function replaySnapshot(token, boardId, snapshot, options) {
  const { includeCards, resetToFirstList } = options;

  const listIds = [];

  for (const [index, list] of (snapshot.lists || []).entries()) {
    const created = await planka.createList(token, boardId, {
      name: list.name,
      position: (index + 1) * GAP,
      color: list.color,
    });

    listIds.push(created.item.id);
  }

  const labelIds = [];

  for (const [index, label] of (snapshot.labels || []).entries()) {
    const created = await planka.createLabel(token, boardId, {
      name: label.name || null,
      position: (index + 1) * GAP,
      color: label.color,
    });

    labelIds.push(created.item.id);
  }

  let createdCards = 0;

  if (includeCards && listIds.length > 0) {
    // Her liste icinde kart pozisyonlarini artan sekilde vermek icin sayac tutariz.
    const nextPositionByListId = new Map();

    for (const card of snapshot.cards || []) {
      const targetListId = resetToFirstList ? listIds[0] : listIds[card.listIndex] || listIds[0];
      const position = (nextPositionByListId.get(targetListId) || 0) + GAP;
      nextPositionByListId.set(targetListId, position);

      const created = await planka.createCard(token, targetListId, {
        name: card.name,
        description: card.description,
        type: card.type,
        position,
      });

      const cardId = created.item.id;
      createdCards += 1;

      for (const labelIndex of card.labelIndexes || []) {
        if (labelIds[labelIndex]) {
          await planka.addCardLabel(token, cardId, labelIds[labelIndex]);
        }
      }

      for (const [taskListIndex, taskList] of (card.taskLists || []).entries()) {
        const createdTaskList = await planka.createTaskList(token, cardId, {
          name: taskList.name,
          position: (taskListIndex + 1) * GAP,
          showOnFrontOfCard: taskList.showOnFrontOfCard,
        });

        for (const [taskIndex, task] of (taskList.tasks || []).entries()) {
          await planka.createTask(token, createdTaskList.item.id, {
            name: task.name,
            position: (taskIndex + 1) * GAP,
          });
        }
      }
    }
  }

  return { lists: listIds.length, labels: labelIds.length, cards: createdCards };
}

/**
 * Sablonu duzenleme/silme yetkisi: sablonu olusturan kisi veya Planka yoneticisi.
 * Sahibi bilinmeyen eski kayitlar (created_by_user_id NULL) yalnizca yoneticiye aciktir.
 */
function canManage(row, user) {
  return isAdmin(user) || (Boolean(row.created_by_user_id) && row.created_by_user_id === user.id);
}

module.exports = (app) => {
  app.get(
    '/api/templates',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ templates: db.listTemplates() });
    }),
  );

  app.post(
    '/api/templates',
    requireAuth,
    asyncRoute(async (req, res) => {
      const { boardId, name, description } = req.body || {};

      if (!boardId) {
        res.status(400).json({ error: 'boardId gerekli.' });
        return;
      }

      const boardResponse = await planka.getBoard(req.plankaToken, boardId);
      const snapshot = buildSnapshot(boardResponse);

      const template = db.createTemplate({
        name: (name || snapshot.board.name || 'Isimsiz sablon').trim(),
        description: description || null,
        sourceBoardId: boardId,
        sourceBoardName: snapshot.board.name,
        createdBy: req.user.name || req.user.username || null,
        createdByUserId: req.user.id,
        snapshot: JSON.stringify(snapshot),
        createdAt: new Date().toISOString(),
      });

      res.status(201).json({ template });
    }),
  );

  app.patch(
    '/api/templates/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const row = db.getTemplateRow(Number(req.params.id));

      if (!row) {
        res.status(404).json({ error: 'Sablon bulunamadi.' });
        return;
      }

      if (!canManage(row, req.user)) {
        res.status(403).json({ error: 'Bu sablonu yalnizca olusturan kisi veya yonetici duzenleyebilir.' });
        return;
      }

      const { name, description } = req.body || {};

      res.json({
        template: db.renameTemplate(
          row.id,
          (name || row.name).trim(),
          description === undefined ? row.description : description,
        ),
      });
    }),
  );

  app.delete(
    '/api/templates/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const row = db.getTemplateRow(Number(req.params.id));

      if (!row) {
        res.status(404).json({ error: 'Sablon bulunamadi.' });
        return;
      }

      if (!canManage(row, req.user)) {
        res.status(403).json({ error: 'Bu sablonu yalnizca olusturan kisi veya yonetici silebilir.' });
        return;
      }

      db.deleteTemplate(row.id);
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/templates/:id/instantiate',
    requireAuth,
    asyncRoute(async (req, res) => {
      const row = db.getTemplateRow(Number(req.params.id));

      if (!row) {
        res.status(404).json({ error: 'Sablon bulunamadi.' });
        return;
      }

      const { projectId, name, includeCards = true, resetToFirstList = true } = req.body || {};

      if (!projectId) {
        res.status(400).json({ error: 'Hangi birimde olusturulacagi (projectId) gerekli.' });
        return;
      }

      const snapshot = JSON.parse(row.snapshot);

      const created = await planka.createBoard(req.plankaToken, projectId, {
        name: (name || row.name).trim(),
        position: await nextBoardPosition(req.plankaToken, projectId),
      });

      const boardId = created.item.id;

      try {
        const stats = await replaySnapshot(req.plankaToken, boardId, snapshot, {
          includeCards,
          resetToFirstList,
        });

        // Kullanici kurali: her yeni etkinlik panosu 4 varsayilan listeyle
        // gelir (Başlanmadı/Yapılıyor/Yapıldı/İptal Edildi). Şablonda
        // olmayanlar burada tamamlanır.
        const varsayilanSonuc = await varsayilan.ensure(req.plankaToken, boardId);
        stats.varsayilanListeler = varsayilanSonuc.eklendi.length;

        res.status(201).json({ boardId, url: boardUrl(boardId), stats });
      } catch (error) {
        // Board acildi ama icerik yarim kaldi: kullaniciya durumu oldugu gibi bildiriyoruz.
        console.error('[companion] sablon uygulanirken hata:', error);

        res.status(502).json({
          error: `Board olusturuldu fakat icerik kopyalanirken hata olustu: ${error.message}`,
          partial: true,
          boardId,
          url: boardUrl(boardId),
        });
      }
    }),
  );
};
