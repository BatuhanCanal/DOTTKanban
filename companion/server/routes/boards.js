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
const varsayilanListeler = require('../varsayilan-listeler');

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

      // Etiket turleri (Ekip, Etkinlik Turu...) companion'da durur; pano
      // verisine eklenir ki arayuz dinamik "... gore" sekmeleri uretebilsin.
      const groupItems = db.listLabelGroupItemsForBoard(req.params.boardId);
      const groups = db.listLabelGroups();

      board.labelGroups = groups
        .map((group) => ({
          id: group.id,
          name: group.name,
          labelIds: groupItems[group.id] || [],
        }))
        .filter((group) => group.labelIds.length > 0);

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
        res.status(404).json({ error: 'Kart bu panoda bulunamadı.' });
        return;
      }

      // null/bos gonderilmesi "baslangic tarihini kaldir" demektir.
      if (!startDate) {
        db.clearCardStartDate(req.params.cardId);
        res.json({ ok: true, startDate: null });
        return;
      }

      if (!isValidDay(startDate)) {
        res.status(400).json({ error: 'Tarih YYYY-AA-GG biçiminde olmalı.' });
        return;
      }

      if (card.dueDate && startDate > card.dueDate.slice(0, 10)) {
        res.status(400).json({ error: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.' });
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
        res.status(400).json({ error: 'Tarih YYYY-AA-GG biçiminde olmalı.' });
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

  // --------------------------------------------------------------------------
  // GÖREV EKLE (Companion içinden)
  //
  // Kullanıcı kuralı: yeni göreve eklerken bu panoya bağlı etiket turlerinin
  // HEPSİ atanmış olmalı (örn. Ekip + Etkinlik Türü). Bu kural sunucu seviyesinde
  // zorunlu: assignments içinde eksik tür varsa istek reddedilir.
  // --------------------------------------------------------------------------
  app.post(
    '/api/boards/:boardId/cards',
    requireAuth,
    asyncRoute(async (req, res) => {
      const boardId = req.params.boardId;
      const { name, listId, assignments = {}, startDate, dueDate, description } =
        req.body || {};

      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Görev adı gerekli.' });
        return;
      }

      const response = await planka.getBoard(req.plankaToken, boardId);
      const board = normalizeBoard(response);

      // 1) Hedef liste (varsayılan: ilk aktif sütun = Başlanmadı)
      const hedefListe = listId ? board.lists.find((list) => list.id === listId) : board.lists[0];

      if (!hedefListe) {
        res
          .status(400)
          .json({ error: 'Bu panoda aktif sütun yok; önce Planka\'da bir liste oluşturun.' });
        return;
      }

      // 2) Etiket türü zorunluluğu: bu panoya bağlı VE en az bir etiketi
      //    olan türler zorunludur; bağlı etiketi hiç olmayan tur istenemez.
      const baglanmis = db.listLabelGroupItemsForBoard(boardId);
      const groups = db.listLabelGroups();

      const eksikTur = [];

      for (const group of groups) {
        const bagliEtiketler = baglanmis[group.id] || [];

        if (bagliEtiketler.length === 0) {
          continue;
        }

        const secim = assignments[group.id];

        if (!secim || !bagliEtiketler.includes(String(secim))) {
          eksikTur.push(group.name);
        }
      }

      if (eksikTur.length > 0) {
        res.status(400).json({
          error:
            'Bu panoda şu etiket türleri atanmalıdır: ' +
            eksikTur.join(', ') +
            '. Görevi kaydetmeden önce eksik olanları seçin.',
          eksikTurler: eksikTur,
        });
        return;
      }

      const secilenEtiketler = Object.values(assignments);

      const boardEtiketIds = new Set(board.labels.map((label) => label.id));

      for (const labelId of secilenEtiketler) {
        if (!boardEtiketIds.has(labelId)) {
          res.status(400).json({ error: 'Seçilen etiketlerden biri bu panoda bulunmuyor.' });
          return;
        }
      }

      // 3) Tarih doğrulama
      if (startDate && dueDate && startDate > dueDate) {
        res.status(400).json({ error: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.' });
        return;
      }

      // 4) Kart oluşturma: sütundaki mevcut maksimum pozisyonun sonrası
      const listPositions = board.cards
        .filter((card) => card.listId === hedefListe.id)
        .map((card) => card.position ?? 0)
        .sort((a, b) => a - b);

      const pozisyon =
        listPositions.length === 0
          ? planka.POSITION_GAP
          : Math.max(...listPositions) + planka.POSITION_GAP;

      const created = await planka.createCard(req.plankaToken, hedefListe.id, {
        name: name.trim(),
        position: pozisyon,
        description,
      });

      const cardId = created.item.id;

      // 5) Etiketleri yaz
      for (const labelId of secilenEtiketler) {
        try {
          await planka.addCardLabel(req.plankaToken, cardId, labelId);
        } catch (error) {
          if (!(error instanceof planka.PlankaError && error.status === 409)) {
            throw error;
          }
        }
      }

      // 6) Tarihleri yaz: bitiş Planka'da, başlangıç companion'da.
      if (dueDate) {
        await planka.updateCard(req.plankaToken, cardId, {
          dueDate: `${dueDate}T12:00:00.000Z`,
        });
      }

      if (startDate) {
        db.setCardStartDate({
          cardId,
          boardId,
          startDate,
          updatedBy: req.user.name || req.user.username || null,
          updatedAt: new Date().toISOString(),
        });
      }

      res.status(201).json({
        ok: true,
        cardId,
        listId: hedefListe.id,
        etiketler: secilenEtiketler,
      });
    }),
  );

  // Eksik varsayılan listeleri ekler (örn. İptal Edildi).
  app.post(
    '/api/boards/:boardId/varsayilan-listeler',
    requireAuth,
    asyncRoute(async (req, res) => {
      const sonuc = await varsayilanListeler.ensure(req.plankaToken, req.params.boardId);
      res.json({ ok: true, ...sonuc });
    }),
  );

  // Panoda eksik varsayılan liste var mı?
  app.get(
    '/api/boards/:boardId/eksik-listeler',
    requireAuth,
    asyncRoute(async (req, res) => {
      const sonuc = await varsayilanListeler.eksikler(req.plankaToken, req.params.boardId);
      res.json(sonuc);
    }),
  );
};