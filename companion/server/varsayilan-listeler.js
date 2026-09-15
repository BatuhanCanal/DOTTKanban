'use strict';

/**
 * Varsayilan liste (sutun) yoneticisi.
 *
 * Kullanici istegi: her yeni etkinlik panosu şu 4 liste ile gelir:
 *   Başlanmadı / Yapılıyor / Yapıldı / İptal Edildi
 *
 * Planka panolari elle de olusturulabildigi icin ekleme orn每位
 * buradaki yardimci hem sablon kurulunca hem de "eksikleri ekle"
 * dugmesinden kullanılır. Mevcut listeler ASLlgÍN adlarıve AYNIen kasılmaya
 * cevrilmez; yalnizca olmayanlar listeye eklenir.
 */

const planka = require('./planka');
const { normalizeBoard } = require('./board-data');

const VARSAYILAN_LISTELER = ['Başlanmadı', 'Yapılıyor', 'Yapıldı', 'İptal Edildi'];

/** Panoda hangi varsayilan listeler eksik? */
async function eksikler(token, boardId) {
  const response = await planka.getBoard(token, boardId);
  const board = normalizeBoard(response);

  const mevcut = new Set(board.lists.map((list) => list.name));

  return {
    eksik: VARSAYILAN_LISTELER.filter((name) => !mevcut.has(name)),
    mevcut: board.lists.map((list) => list.name),
  };
}

/** Panodaki eksik varsayilan listeleri ekler; olanlara dokunmaz. */
async function ensure(token, boardId) {
  const mevcut = await eksikler(token, boardId);

  let baslangicPozisyon = await pozisyon(token, boardId);

  const eklenen = [];

  for (const name of mevcut.eksik) {
    const created = await planka.createList(token, boardId, {
      name,
      position: baslangicPozisyon + planka.POSITION_GAP,
    });

    eklenen.push(created.item.name);
    baslangicPozisyon += planka.POSITION_GAP;
  }

  return { eklendi: eklenen, mevcut: mevcut.mevcut };
}

/** Panonun sonda maksimum liste pozisyonu. */
async function pozisyon(token, boardId) {
  const response = await planka.getBoard(token, boardId);
  const board = normalizeBoard(response);
  return Math.max(0, ...board.lists.map((list) => list.position ?? 0));
}

module.exports = { VARSAYILAN_LISTELER, eksikler, ensure, pozisyon };

