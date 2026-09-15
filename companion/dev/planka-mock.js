'use strict';

/**
 * SAHTE PLANKA — yalnızca yerel önizleme için.
 *
 * NEDEN VAR:
 *   Companion, Planka'nın REST API'siyle konuşur. Docker kurmadan (dolayısıyla
 *   Planka olmadan) arayüzü ve özellikleri denemek mümkün olsun diye, Planka'nın
 *   companion'ın kullandığı KADARINI taklit eden küçük bir sunucu.
 *
 * NE DEĞİLDİR:
 *   Gerçek bir Kanban uygulaması değildir. Veriler yalnızca bellekte tutulur:
 *   sunucuyu kapatınca her şey başlar ve örnek verilere döner. Kalıcı veri,
 *   gerçek kullanıcılar ve yetkilendirme yoktur. Üretimde kullanılmaz.
 *
 * KULLANIM:
 *   node companion/dev/planka-mock.js
 *   (varsayılan port 1337 — Planka'nın konteyner içi portuyla aynı)
 *
 *   Sonra companion'ı bu sahte sunucuya yönlendirin:
 *     PLANKA_INTERNAL_URL=http://localhost:1337 \
 *     PLANKA_PUBLIC_URL=http://localhost:1337 \
 *     DATABASE_PATH=/tmp/onizleme.db PORT=3001 \
 *     node server/index.js
 *
 *   Kısayol: ./scripts/yerel-onizleme.sh ikisini birlikte başlatır.
 *
 * GİRİŞ:
 *   Herhangi bir kullanıcı adı + herhangi bir şifre kabul edilir (sahte sunucu).
 *   Kullanıcı adı "admin" ise yönetici olarak girer — "Etiket Türleri" menüsü
 *   görünür. Başka bir ad yazarsanız normal üye olarak girer ve o menü gizlenir;
 *   yetki farkını denemek için kullanışlıdır.
 */

const http = require('http');

const PORT = Number(process.env.MOCK_PORT || 1337);

// --- Örnek veri -------------------------------------------------------------
// Kimlikler sabit ve okunur: hata ayıklarken hangi kartın hangi etiketi
// taşıdığını JSON içinde görebilmek işi kolaylaştırır.

const PROJECTS = [
  { id: 'proje-yazilim', name: 'Yazılım', description: 'Yazılım ekibi etkinlikleri' },
  { id: 'proje-etkinlik', name: 'Etkinlik', description: 'Topluluk etkinlikleri' },
];

const BOARDS = [
  { id: 'pano-tanisma', projectId: 'proje-etkinlik', name: 'Tanışma Etkinliği', position: 65536 },
  { id: 'pano-teatalk', projectId: 'proje-etkinlik', name: 'Tea&Talk #12', position: 131072 },
  { id: 'pano-workshop', projectId: 'proje-yazilim', name: 'Workshop: Git', position: 65536 },
];

/**
 * Panoların ortak iskeleti. Planka her panoya "archive" ve "trash" adında iki
 * sistem listesi ekler; companion onları dışarıda bırakır (board-data.js).
 * Sahte sunucu da onları ekliyor ki bu filtre gerçekten sınanmış olsun.
 */
function seedBoard(boardId) {
  const lists = [
    { id: `${boardId}-l1`, type: 'active', name: 'Başlanmadı', position: 65536, color: null },
    { id: `${boardId}-l2`, type: 'active', name: 'Yapılıyor', position: 131072, color: null },
    { id: `${boardId}-l3`, type: 'active', name: 'Tamamlandı', position: 196608, color: null },
    { id: `${boardId}-archive`, type: 'archive', name: 'Arşiv', position: 262144, color: null },
    { id: `${boardId}-trash`, type: 'trash', name: 'Çöp', position: 327680, color: null },
  ];

  // İki ayrı eksen: sunucuda "tür" olarak tanımlanacak etiketler.
  // Örnek veride Etkinlik Türü etiketleri aynı panoya bağlanır; Ekip etiketleri
  // de öyle — böylece pano sayfasında iki ayrı sekme doğar.
  const labels = [
    { id: `${boardId}-ekip-org`, name: 'Organizasyon', color: 'egg-yellow', position: 65536 },
    { id: `${boardId}-ekip-tasarim`, name: 'Tasarım', color: 'summer-sky', position: 131072 },
    { id: `${boardId}-ekip-sosyal`, name: 'Sosyal Medya', color: 'pink-tulip', position: 196608 },
    { id: `${boardId}-tur-teatalk`, name: 'Tea&Talk', color: 'light-cocoa', position: 262144 },
    { id: `${boardId}-tur-tanisma`, name: 'Tanışma Etkinliği', color: 'wet-moss', position: 327680 },
    { id: `${boardId}-yiyecek`, name: 'Yiyecek', color: 'orange-peel', position: 393216 },
  ];

  return { lists, labels };
}

const CARDS = [
  {
    id: 'kart-1', boardId: 'pano-tanisma', listId: 'pano-tanisma-l1', position: 65536,
    name: 'Mekan araştırması ve rezervasyon', description: 'Merkeze yakın, 40 kişilik',
    dueDate: '2026-09-25T12:00:00.000Z', isDueCompleted: false,
    labels: ['pano-tanisma-ekip-org', 'pano-tanisma-tur-tanisma'],
    members: ['kullanici-ayse'], tasks: [['Mekan listesi çıkar', true], ['Fiyat sor', false]],
  },
  {
    id: 'kart-2', boardId: 'pano-tanisma', listId: 'pano-tanisma-l2', position: 65536,
    name: 'Tanıtım afişi tasarımı', description: null,
    dueDate: '2026-09-30T12:00:00.000Z', isDueCompleted: false,
    labels: ['pano-tanisma-ekip-tasarim', 'pano-tanisma-tur-tanisma'],
    members: ['kullanici-mehmet'], tasks: [['Taslak', true], ['Revizyon', false], ['Baskı', false]],
  },
  {
    id: 'kart-3', boardId: 'pano-tanisma', listId: 'pano-tanisma-l2', position: 131072,
    name: 'Sosyal medya duyuru planı', description: null,
    dueDate: '2026-09-28T12:00:00.000Z', isDueCompleted: false,
    labels: ['pano-tanisma-ekip-sosyal', 'pano-tanisma-tur-tanisma'],
    members: ['kullanici-ayse', 'kullanici-mehmet'], tasks: [],
  },
  {
    id: 'kart-4', boardId: 'pano-tanisma', listId: 'pano-tanisma-l3', position: 65536,
    name: 'Bütçe onayı', description: null,
    dueDate: '2026-09-20T12:00:00.000Z', isDueCompleted: true,
    labels: ['pano-tanisma-ekip-org'], members: [], tasks: [],
  },
  {
    id: 'kart-5', boardId: 'pano-tanisma', listId: 'pano-tanisma-l1', position: 131072,
    name: 'İkram listesi (etiketsiz kart örneği)', description: null,
    dueDate: null, isDueCompleted: false,
    labels: [], members: [], tasks: [],
  },
  {
    id: 'kart-6', boardId: 'pano-teatalk', listId: 'pano-teatalk-l1', position: 65536,
    name: 'Konuşmacı daveti', description: null,
    dueDate: '2026-10-05T12:00:00.000Z', isDueCompleted: false,
    labels: ['pano-teatalk-ekip-org', 'pano-teatalk-tur-teatalk'],
    members: ['kullanici-mehmet'], tasks: [['Kısa liste', true], ['Davet gönder', false]],
  },
  {
    id: 'kart-7', boardId: 'pano-teatalk', listId: 'pano-teatalk-l2', position: 65536,
    name: 'Çay/kurabiye organizasyonu', description: null,
    dueDate: '2026-10-07T12:00:00.000Z', isDueCompleted: false,
    labels: ['pano-teatalk-yiyecek', 'pano-teatalk-tur-teatalk'],
    members: ['kullanici-ayse'], tasks: [],
  },
  {
    id: 'kart-8', boardId: 'pano-workshop', listId: 'pano-workshop-l1', position: 65536,
    name: 'Repo ve branch düzeni anlatımı', description: null,
    dueDate: '2026-10-12T12:00:00.000Z', isDueCompleted: false,
    labels: ['pano-workshop-ekip-tasarim'], members: ['kullanici-mehmet'], tasks: [],
  },
];

const MEMBERSHIPS = CARDS.flatMap((card) =>
  card.members.map((userId) => ({ id: `uye-${card.id}-${userId}`, cardId: card.id, userId })),
);

const USERS = [
  { id: 'kullanici-admin', name: 'Yönetici', username: 'admin', email: 'admin@dott.local', role: 'admin' },
  { id: 'kullanici-ayse', name: 'Ayşe Yılmaz', username: 'ayse', email: 'ayse@dott.local', role: 'member' },
  { id: 'kullanici-mehmet', name: 'Mehmet Kaya', username: 'mehmet', email: 'mehmet@dott.local', role: 'member' },
];

// --- Bellekteki durum -------------------------------------------------------
// Kart/etiket/liste değişiklikleri burada tutulur; süreç kapanınca sıfırlanır.

const state = {
  lists: [],
  labels: [],
  cards: [],
  cardLabels: [],
  cardMemberships: MEMBERSHIPS,
  taskLists: [],
  tasks: [],
};

for (const board of BOARDS) {
  const { lists, labels } = seedBoard(board.id);
  state.lists.push(...lists);
  state.labels.push(...labels);
}

let labelCounter = 0;
let taskCounter = 0;

for (const card of CARDS) {
  state.cards.push({
    id: card.id,
    listId: card.listId,
    name: card.name,
    description: card.description,
    dueDate: card.dueDate,
    isDueCompleted: card.isDueCompleted,
    position: card.position,
    type: 'project',
  });

  for (const labelId of card.labels) {
    state.cardLabels.push({ id: `cl-${card.id}-${labelId}`, cardId: card.id, labelId });
  }

  if (card.tasks.length > 0) {
    const taskListId = `tl-${card.id}`;
    state.taskLists.push({ id: taskListId, cardId: card.id, name: 'Yapılacaklar', position: 65536 });

    card.tasks.forEach(([name, isCompleted], index) => {
      taskCounter += 1;
      state.tasks.push({
        id: `gorev-${taskCounter}`,
        taskListId,
        name,
        isCompleted,
        position: 65536 * (index + 1),
      });
    });
  }
}

// --- Yardımcılar ------------------------------------------------------------

const boardOfList = (listId) => BOARDS.find((b) => listId.startsWith(b.id));

/** Bir panonun tüm verisi: companion'ın beklediği `included` şekli. */
function boardPayload(board) {
  const listIds = new Set(state.lists.filter((l) => boardOfList(l.id)?.id === board.id).map((l) => l.id));
  const cards = state.cards.filter((c) => listIds.has(c.listId));
  const cardIds = new Set(cards.map((c) => c.id));
  const taskLists = state.taskLists.filter((t) => cardIds.has(t.cardId));
  const taskListIds = new Set(taskLists.map((t) => t.id));

  return {
    item: { ...board, type: 'project' },
    included: {
      lists: state.lists.filter((l) => listIds.has(l.id)),
      labels: state.labels.filter((l) => l.id.startsWith(board.id)),
      cards,
      cardLabels: state.cardLabels.filter((cl) => cardIds.has(cl.cardId)),
      cardMemberships: state.cardMemberships.filter((m) => cardIds.has(m.cardId)),
      taskLists,
      tasks: state.tasks.filter((t) => taskListIds.has(t.taskListId)),
      users: USERS,
      // Gerçek Planka, panonun YALNIZCA kendi projesini döndürür; companion da
      // `included.projects[0]` ile eşler. Burada tüm projeleri döndürmek panonun
      // birimini yanlış gösteriyordu (ilk proje esas alınıyordu).
      projects: PROJECTS.filter((p) => p.id === board.projectId),
    },
  };
}

const findBoardByListId = (listId) => {
  const list = state.lists.find((l) => l.id === listId);
  return list ? boardOfList(list.id) : null;
};

const nextPosition = (items, predicate) => {
  const pool = items.filter(predicate).map((i) => i.position ?? 0);
  return pool.length === 0 ? 65536 : Math.max(...pool) + 65536;
};

// --- HTTP ------------------------------------------------------------------

function json(res, status, payload) {
  const body = payload === null ? '' : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

/** Kullanıcı adından kimlik üretir: "admin" -> yönetici, diğerleri -> üye. */
function userForLogin(emailOrUsername) {
  const key = String(emailOrUsername || '').toLowerCase();
  const known = USERS.find(
    (u) => u.username.toLowerCase() === key || u.email.toLowerCase() === key,
  );

  if (known) {
    return known;
  }

  // Bilinmeyen ad: üye olarak uydur. Amaç, farklı hesaplarla yetki farkını
  // deneyebilmek (yalnızca "admin" yönetici olur).
  return {
    id: `kullanici-${key.replace(/[^a-z0-9]/g, '') || 'misafir'}`,
    name: emailOrUsername,
    username: emailOrUsername,
    email: `${key}@ornek.local`,
    role: 'member',
  };
}

// Token -> kullanıcı. companion token'ı çerezde taşır ve her istekte doğrulatır.
const sessions = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // Gerçek Planka'da Authorization zorunludur; sahte sunucuda yalnızca
  // token'ın varlığına bakıyoruz (yetki kontrolü bu mock'un işi değil).
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);

  const body = method === 'POST' || method === 'PATCH' || method === 'PUT' ? await readBody(req) : {};

  // --- Oturum ---
  if (method === 'POST' && path === '/api/access-tokens') {
    const user = userForLogin(body.emailOrUsername);

    if (!body.password) {
      json(res, 401, { message: 'Şifre gerekli.' });
      return;
    }

    const newToken = `mock-${user.id}-${Date.now()}`;
    sessions.set(newToken, user);

    json(res, 200, { item: newToken });
    return;
  }

  if (method === 'GET' && path === '/api/users/me') {
    if (!session) {
      json(res, 401, { message: 'Oturum bulunamadı.' });
      return;
    }

    json(res, 200, { item: session });
    return;
  }

  // --- Projeler ve panolar ---
  if (method === 'GET' && path === '/api/projects') {
    json(res, 200, { items: PROJECTS, included: { boards: BOARDS } });
    return;
  }

  const boardMatch = path.match(/^\/api\/boards\/([^/]+)$/);

  if (method === 'GET' && boardMatch) {
    const board = BOARDS.find((b) => b.id === boardMatch[1]);

    if (!board) {
      json(res, 404, { message: 'Pano bulunamadı.' });
      return;
    }

    json(res, 200, boardPayload(board));
    return;
  }

  // Şablon oluşturma sırasında kullanılır.
  const createBoardMatch = path.match(/^\/api\/projects\/([^/]+)\/boards$/);

  if (method === 'POST' && createBoardMatch) {
    const board = {
      id: `pano-${Date.now()}`,
      projectId: createBoardMatch[1],
      name: body.name || 'Yeni pano',
      position: body.position ?? 65536,
    };

    BOARDS.push(board);

    const { lists, labels } = seedBoard(board.id);
    state.lists.push(...lists);
    state.labels.push(...labels);

    json(res, 200, { item: board });
    return;
  }

  const createListMatch = path.match(/^\/api\/boards\/([^/]+)\/lists$/);

  if (method === 'POST' && createListMatch) {
    const list = {
      id: `${createListMatch[1]}-yeni-${Date.now()}`,
      type: body.type || 'active',
      name: body.name || 'Yeni liste',
      position: body.position ?? 65536,
      color: body.color || null,
    };

    state.lists.push(list);
    json(res, 200, { item: list });
    return;
  }

  const createLabelMatch = path.match(/^\/api\/boards\/([^/]+)\/labels$/);

  if (method === 'POST' && createLabelMatch) {
    labelCounter += 1;
    const label = {
      id: `${createLabelMatch[1]}-etiket-${labelCounter}`,
      boardId: createLabelMatch[1],
      name: body.name || 'Etiket',
      color: body.color || 'egg-yellow',
      position: body.position ?? 65536,
    };

    state.labels.push(label);
    json(res, 200, { item: label });
    return;
  }

  // --- Kartlar ---
  const createCardMatch = path.match(/^\/api\/lists\/([^/]+)\/cards$/);

  if (method === 'POST' && createCardMatch) {
    const card = {
      id: `kart-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      listId: createCardMatch[1],
      name: body.name || 'Yeni kart',
      description: body.description || null,
      dueDate: null,
      isDueCompleted: false,
      position: body.position ?? 65536,
      type: body.type || 'project',
    };

    state.cards.push(card);
    json(res, 200, { item: card });
    return;
  }

  const patchCardMatch = path.match(/^\/api\/cards\/([^/]+)$/);

  if (method === 'PATCH' && patchCardMatch) {
    const card = state.cards.find((c) => c.id === patchCardMatch[1]);

    if (!card) {
      json(res, 404, { message: 'Kart bulunamadı.' });
      return;
    }

    // Yalnızca companion'ın kullandığı alanlar: liste taşıma ve tarihler.
    for (const key of ['listId', 'position', 'name', 'description', 'dueDate', 'isDueCompleted']) {
      if (key in body) {
        card[key] = body[key];
      }
    }

    json(res, 200, { item: card });
    return;
  }

  const addLabelMatch = path.match(/^\/api\/cards\/([^/]+)\/card-labels$/);

  if (method === 'POST' && addLabelMatch) {
    const cardId = addLabelMatch[1];
    const existing = state.cardLabels.find(
      (cl) => cl.cardId === cardId && cl.labelId === body.labelId,
    );

    if (existing) {
      json(res, 409, { message: 'Etiket zaten kartta.' });
      return;
    }

    const cardLabel = { id: `cl-${cardId}-${body.labelId}`, cardId, labelId: body.labelId };
    state.cardLabels.push(cardLabel);
    json(res, 200, { item: cardLabel });
    return;
  }

  // Planka'nın silme yolu kimliği "labelId:" önekiyle taşır.
  const removeLabelMatch = path.match(/^\/api\/cards\/([^/]+)\/card-labels\/labelId:(.+)$/);

  if (method === 'DELETE' && removeLabelMatch) {
    const [, cardId, labelId] = removeLabelMatch;
    const before = state.cardLabels.length;

    state.cardLabels = state.cardLabels.filter(
      (cl) => !(cl.cardId === cardId && cl.labelId === labelId),
    );

    json(res, before === state.cardLabels.length ? 404 : 200, { item: {} });
    return;
  }

  // --- Kontrol listeleri ---
  const createTaskListMatch = path.match(/^\/api\/cards\/([^/]+)\/task-lists$/);

  if (method === 'POST' && createTaskListMatch) {
    const taskList = {
      id: `tl-${Date.now()}`,
      cardId: createTaskListMatch[1],
      name: body.name || 'Yapılacaklar',
      position: body.position ?? 65536,
      showOnFrontOfCard: body.showOnFrontOfCard ?? false,
    };

    state.taskLists.push(taskList);
    json(res, 200, { item: taskList });
    return;
  }

  const createTaskMatch = path.match(/^\/api\/task-lists\/([^/]+)\/tasks$/);

  if (method === 'POST' && createTaskMatch) {
    taskCounter += 1;
    const task = {
      id: `gorev-${taskCounter}`,
      taskListId: createTaskMatch[1],
      name: body.name || 'Görev',
      isCompleted: false,
      position: body.position ?? 65536,
    };

    state.tasks.push(task);
    json(res, 200, { item: task });
    return;
  }

  json(res, 404, { message: `Sahte Planka bu ucu bilmiyor: ${method} ${path}` });
});

server.listen(PORT, () => {
  console.log(`[sahte-planka] http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`[sahte-planka] ${PROJECTS.length} birim, ${BOARDS.length} pano, ${state.cards.length} kart`);
  console.log('[sahte-planka] giriş: herhangi bir kullanıcı adı + şifre');
  console.log('[sahte-planka] "admin" adıyla girerseniz yönetici yetkisiyle girer');
  console.log('[sahte-planka] veriler yalnızca bellekte — kapatınca sıfırlanır');
});
