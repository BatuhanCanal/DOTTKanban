'use strict';

/**
 * Companion'in kendi kucuk veritabani.
 *
 * Burada SADECE Planka'da karsiligi olmayan veri tutulur:
 *   - sablonlar,
 *   - kartlarin BASLANGIC tarihi (Planka kartta yalnizca bitis tarihi tutar;
 *     zaman cizelgesinde cubuk cizebilmek icin baslangici biz sakliyoruz).
 * Kartlar, listeler, etiketler vb. her zaman Planka'da yasar; buraya kopyalanmaz.
 */

// Node'un yerlesik SQLite'i kullanilir (node:sqlite) - derlenmesi gereken
// harici bir bagimlilik yoktur.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const config = require('./config');

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const db = new DatabaseSync(config.databasePath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    source_board_id TEXT,
    source_board_name TEXT,
    created_by TEXT,
    created_by_user_id TEXT,
    snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Gecis: created_by_user_id daha sonra eklendi. Once kaydedilmis sablonlarda
// bu alan NULL kalir; sahibi bilinmedigi icin onlari yalnizca Planka yoneticisi
// silebilir/yeniden adlandirabilir (bkz. routes/templates.js).
const templateColumns = db.prepare(`PRAGMA table_info(templates)`).all().map((c) => c.name);

if (!templateColumns.includes('created_by_user_id')) {
  db.exec(`ALTER TABLE templates ADD COLUMN created_by_user_id TEXT`);
}

// Kartlarin baslangic tarihi. Planka'nin kart tablosunda boyle bir alan yok;
// zaman cizelgesindeki cubugun sol ucu buradan gelir. Kart Planka'da silinirse
// buradaki satir oksuz kalir - zararsizdir, cunku gorunum her zaman Planka'dan
// gelen kart listesiyle eslestirilir (bkz. routes/boards.js).
db.exec(`
  CREATE TABLE IF NOT EXISTS card_dates (
    card_id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL
  );
`);

db.exec(`CREATE INDEX IF NOT EXISTS card_dates_board_id ON card_dates (board_id)`);

const statements = {
  listTemplates: db.prepare(
    `SELECT id, name, description, source_board_id, source_board_name, created_by,
            created_by_user_id, snapshot, created_at
       FROM templates
      ORDER BY created_at DESC`,
  ),
  getTemplate: db.prepare(`SELECT * FROM templates WHERE id = ?`),
  insertTemplate: db.prepare(
    `INSERT INTO templates (name, description, source_board_id, source_board_name, created_by,
                            created_by_user_id, snapshot, created_at)
     VALUES (@name, @description, @sourceBoardId, @sourceBoardName, @createdBy,
             @createdByUserId, @snapshot, @createdAt)`,
  ),
  renameTemplate: db.prepare(`UPDATE templates SET name = ?, description = ? WHERE id = ?`),
  deleteTemplate: db.prepare(`DELETE FROM templates WHERE id = ?`),

  listCardDates: db.prepare(
    `SELECT card_id, start_date FROM card_dates WHERE board_id = ?`,
  ),
  upsertCardDate: db.prepare(
    `INSERT INTO card_dates (card_id, board_id, start_date, updated_by, updated_at)
     VALUES (@cardId, @boardId, @startDate, @updatedBy, @updatedAt)
     ON CONFLICT (card_id) DO UPDATE SET
       board_id = @boardId,
       start_date = @startDate,
       updated_by = @updatedBy,
       updated_at = @updatedAt`,
  ),
  deleteCardDate: db.prepare(`DELETE FROM card_dates WHERE card_id = ?`),
};

/** Satiri API'nin dondurdugu sekle cevirir (snapshot'tan sadece ozet bilgi verir). */
function presentTemplate(row) {
  if (!row) {
    return null;
  }

  let snapshot = {};

  try {
    snapshot = JSON.parse(row.snapshot);
  } catch {
    snapshot = {};
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sourceBoardId: row.source_board_id,
    sourceBoardName: row.source_board_name,
    createdBy: row.created_by,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    stats: {
      lists: (snapshot.lists || []).length,
      labels: (snapshot.labels || []).length,
      cards: (snapshot.cards || []).length,
    },
  };
}

module.exports = {
  db,

  listTemplates: () => statements.listTemplates.all().map(presentTemplate),

  getTemplateRow: (id) => statements.getTemplate.get(id),

  createTemplate: (values) => {
    const info = statements.insertTemplate.run(values);
    return presentTemplate(statements.getTemplate.get(info.lastInsertRowid));
  },

  renameTemplate: (id, name, description) => {
    statements.renameTemplate.run(name, description, id);
    return presentTemplate(statements.getTemplate.get(id));
  },

  deleteTemplate: (id) => statements.deleteTemplate.run(id).changes > 0,

  /** Bir panodaki tum baslangic tarihleri: { kartId: 'YYYY-MM-DD' } */
  listCardDates: (boardId) =>
    Object.fromEntries(
      statements.listCardDates.all(boardId).map((row) => [row.card_id, row.start_date]),
    ),

  setCardStartDate: (values) => statements.upsertCardDate.run(values),

  clearCardStartDate: (cardId) => statements.deleteCardDate.run(cardId).changes > 0,

  presentTemplate,
};
