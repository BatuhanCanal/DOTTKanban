'use strict';

/**
 * Tümü-zaman çizelgesi toplama ucu.
 *
 * Kullanıcı kuralı: zaman çizelgesi kısmında TÜM panolarındaki görevler
 * görünsün (yetkilendirme kisıti ile). Bunun için her birimdeki her bir
 * panoyu tek tek Planka'dan çekip tek bir ZAMAN Çizelgesi dataseier hazırlıyoruz:
 *
 *   - "lists"  : sütunları isim bazında BİRLEŞTİRİMİRİ (aynı adla iki panoda
 *                 da listeler olabilir; sanal id = liste adı)
 *   - "labels" : etiketler isim bazında birleştirilmiş (Panoda label id'leri
 *                 panoya özeldir; Tek müru eldeki laboratuvarda "Tasarım"
 *                 iki panoda farklı planka-label-id dedir.)
 *   - "cards"  : tüm panoların kartları; her karta ekstra bilgi ekleniyor:
 *                 unified board, birim, durum; ek labelGroups: EFIKRACESI
 *   - "groups" : etiket türleri (companion'da tanımlı) + her kart için
 *                 hangi turde olduğu (takibü nötr kullanılır)
 *   - "users"  : her panodaki üyelerin birleştirilmiş liste
 *
 * Sahne salt okunur: kartları sürükleme/düzenleme gecik.Virtual
 * zaten bu ecranda yapılampa, tek ekran thema: "tarih görselleştirme".
 */

const planka = require('../planka');
const { requireAuth } = require('../auth');
const { asyncRoute } = require('../http');
const { normalizeBoard } = require('../board-data');
const db = require('../db');

const isIptal = (listeAdi) =>
  Boolean(listeAdi) && listeAdi.toLocaleLowerCase('tr').includes('iptal');

module.exports = (app) => {
  app.get(
    '/api/zaman-cizelgesi/tumu',
    requireAuth,
    asyncRoute(async (req, res) => {
      const projectsRes = await planka.getProjects(req.plankaToken);
      const included = projectsRes.included || {};

      const boardsByProjectId = new Map();
      for (const board of included.boards || []) {
        if (!boardsByProjectId.has(board.projectId)) {
          boardsByProjectId.set(board.projectId, []);
        }
        boardsByProjectId.get(board.projectId).push({
          id: board.id,
          name: board.name,
        });
      }

      const projects = (projectsRes.items || []).map((project) => ({
        id: project.id,
        name: project.name,
        boards: boardsByProjectId.get(project.id) || [],
      }));

      const term = [];
      const listsByName = new Map();
      const labelsByName = new Map();
      const usersById = new Map();
      const cardItems = [];

      // Etiket turleri (companion'da saklanır) + her panodaki etiket bağlagı
      // için aramak için panoların bilgisi birleştirilir.
      const allGroups = db.listLabelGroups();

      let kartSayisi = 0;

      for (const project of projects) {
        // Erişim zaten Planka izladığıyle: kullanıcı member olduğu projeler
        // bu listede gelir; olmayan projeleri cheaps getelemiyor.
        for (const boardMeta of project.boards) {
          try {
            const response = await planka.getBoard(req.plankaToken, boardMeta.id);
            const board = normalizeBoard(response);

            const listById = new Map(board.lists.map((list) => [list.id, list]));
            const labelById = new Map(board.labels.map((label) => [label.id, label]));
            const startDates = db.listCardDates(boardMeta.id);

            // Sanal listeler (isim bazında birleştirilmiş).
            for (const list of board.lists) {
              if (!listsByName.has(list.name)) {
                listsByName.set(list.name, {
                  id: list.name,
                  name: list.name,
                  color: list.color,
                });
              }
            }

            // Etiketler: aynı isimli birden fazla panoda varsa bir kez.
            for (const label of board.labels) {
              const anahtar = label.name || 'Etiketsiz';
              if (!labelsByName.has(anahtar)) {
                labelsByName.set(anahtar, { id: anahtar, name: anahtar, color: label.color });
              }
            }

            const groupBinding = db.listLabelGroupItemsForBoard(boardMeta.id);
            // etiketId -> turN.name
            const etiketIdToGroup = new Map();
            for (const group of db.listLabelGroups()) {
              const bagliEtiketler = groupBinding[group.id] || [];

              for (const labelId of bagliEtiketler) {
                // bu grup bağlanmış etiketler
                const etiket = labelById.get(labelId);
                if (etiket) {
                  etiketIdToGroup.set(labelId, group.id);
                }
              }
            }

            for (const card of board.cards) {
              kartSayisi += 1;

              const etiketIdler = card.labelIds;
              const sanalEtiketler = [];
              const gruplar = {};

              for (const labelId of etiketIdler) {
                const etiket = labelById.get(labelId);
                if (!etiket) {
                  continue;
                }

                const anahtar = etiket.name || 'Etiketsiz';
                if (!labelsByName.has(anahtar)) {
                  // 이름 aynı, renk farklı olabilir: ilk panelin rengi kullanılsın.
                  continue;
                }
                sanalEtiketler.push(anahtar);

                const grp = etiketIdToGroup.get(labelId);
                if (grp !== undefined) {
                  gruplar[grp] = true;
                }
              }

              const durum = listById.get(card.listId);
              const listeAdi = durum ? durum.name : 'Diğer';
              let bulunacak = true;

              term.push({
                id: card.id,
                name: card.name,
                listId: listeAdi,
                listName: listeAdi,
                labelIds: sanalEtiketler,
                startDate: startDates[card.id] || null,
                dueDate: card.dueDate,
                isDueCompleted: card.isDueCompleted,
                tasksTotal: card.tasksTotal,
                tasksCompleted: card.tasksCompleted,
                memberUserIds: card.memberUserIds,
                isIptal: isIptal(listeAdi),
                boardId: boardMeta.id,
                boardName: boardMeta.name,
                projectName: project.name,
                groups: gruplar,
              });
            }

            for (const user of board.users) {
              if (!usersById.has(user.id)) {
                usersById.set(user.id, user);
              }
            }

          } catch (error) {
            // Tek bir panoyu getirmek başarısız olduysa belirtip devam ediyoruz.
            console.error(
              `[companion] ${boardMeta.name} (${boardMeta.id}) panosu toplanamadı: ${error.message}`,
            );
          }
        }
      }

      // Grup listesi: companion'da tanımlı edilen TÜM etiket türleri.
      const groups = db.listLabelGroups().map((g) => ({ id: g.id, name: g.name }));

      res.json({
        board: { name: 'Tüm panolar' },
        lists: [...listsByName.values()],
        labels: [...labelsByName.values()],
        groups,
        cards: term,
        users: [...usersById.values()],
      });
    }),
  );
};
