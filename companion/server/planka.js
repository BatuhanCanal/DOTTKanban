'use strict';

/**
 * Planka REST API istemcisi.
 *
 * Bu dosya, companion'in Planka ile konustugu TEK yerdir. Planka'nin kaynak
 * koduna hic dokunmuyoruz; sadece asagidaki resmi uclari cagiriyoruz. Planka
 * guncellendiginde kontrol edilmesi gereken tek dosya burasidir.
 */

const config = require('./config');

// Planka pozisyonlari 65536'lik araliklarla tutar (aradaki bosluga yeni oge
// eklenebilsin diye). Yeni oge eklerken de ayni araligi kullaniyoruz.
const POSITION_GAP = 65536;

class PlankaError extends Error {
  constructor(status, body) {
    const message =
      (body && (body.message || body.problems || body.code)) || `Planka API hatası (${status})`;
    super(typeof message === 'string' ? message : JSON.stringify(message));
    this.name = 'PlankaError';
    this.status = status;
    this.body = body;
  }
}

// Kullanici Planka'ya ilk kez giriyorsa once kullanim sartlarini kabul etmesi
// gerekir. Bunu companion icinde tekrar uygulamiyoruz (yasal metni Planka'nin
// kendi arayuzu gostersin); kullaniciyi Planka'ya yonlendiriyoruz.
class TermsAcceptanceRequiredError extends Error {
  constructor() {
    super('Terms acceptance required');
    this.name = 'TermsAcceptanceRequiredError';
    this.status = 403;
  }
}

/**
 * Yol parcasi kacisi. ID'ler istekten (URL parametresi, govde) gelir; ham
 * birlestirilirse "..%2F.." gibi bir deger Planka'da BASKA bir uca cikar
 * (orn. etiket silme istegi board silmeye doner). Her ID buradan gecer.
 */
const seg = (value) => encodeURIComponent(String(value ?? ''));

async function request(token, method, path, body) {
  // Ek guvenlik agi: yeni bir uc seg() kullanmayi unutursa burada yakalanir.
  if (!path.startsWith('/api/') || path.split('/').includes('..') || path.includes('?')) {
    throw new PlankaError(400, { message: `Gecersiz Planka yolu: ${path}` });
  }

  const headers = { Accept: 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;

  try {
    response = await fetch(`${config.plankaInternalUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new PlankaError(502, { message: `Planka'ya ulaşılamıyor: ${error.message}` });
  }

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text.slice(0, 200) };
    }
  }

  if (!response.ok) {
    throw new PlankaError(response.status, payload);
  }

  return payload;
}

/** Kullanici adi/e-posta + sifre ile giris yapar, erisim token'i dondurur. */
async function login(emailOrUsername, password) {
  try {
    const result = await request(null, 'POST', '/api/access-tokens', {
      emailOrUsername,
      password,
    });

    return result.item;
  } catch (error) {
    if (error instanceof PlankaError && error.status === 403 && error.body && error.body.pendingToken) {
      throw new TermsAcceptanceRequiredError();
    }

    throw error;
  }
}

const getMe = (token) => request(token, 'GET', '/api/users/me');

/** Tum projeler (birimler) + icindeki board'lar (etkinlikler) tek cagrida gelir. */
const getProjects = (token) => request(token, 'GET', '/api/projects');

/**
 * Bir board'un TUM detayi: lists, labels, cards, cardLabels, taskLists, tasks...
 * Hem kategori gorunumu hem sablon anlik goruntusu bu tek cagriyla beslenir.
 */
const getBoard = (token, boardId) => request(token, 'GET', `/api/boards/${seg(boardId)}`);

const createBoard = (token, projectId, { name, position }) =>
  request(token, 'POST', `/api/projects/${seg(projectId)}/boards`, { name, position });

const createList = (token, boardId, { name, position, color }) =>
  request(token, 'POST', `/api/boards/${seg(boardId)}/lists`, {
    type: 'active',
    name,
    position,
    ...(color ? { color } : {}),
  });

const createLabel = (token, boardId, { name, position, color }) =>
  request(token, 'POST', `/api/boards/${seg(boardId)}/labels`, { name, position, color });

const createCard = (token, listId, { name, position, description, type }) =>
  request(token, 'POST', `/api/lists/${seg(listId)}/cards`, {
    type: type || 'project',
    name,
    position,
    ...(description ? { description } : {}),
  });

const updateCard = (token, cardId, values) =>
  request(token, 'PATCH', `/api/cards/${seg(cardId)}`, values);

const addCardLabel = (token, cardId, labelId) =>
  request(token, 'POST', `/api/cards/${seg(cardId)}/card-labels`, { labelId });

const removeCardLabel = (token, cardId, labelId) =>
  request(token, 'DELETE', `/api/cards/${seg(cardId)}/card-labels/labelId:${seg(labelId)}`);

const createTaskList = (token, cardId, { name, position, showOnFrontOfCard }) =>
  request(token, 'POST', `/api/cards/${seg(cardId)}/task-lists`, {
    name,
    position,
    ...(showOnFrontOfCard === undefined ? {} : { showOnFrontOfCard }),
  });

const createTask = (token, taskListId, { name, position }) =>
  request(token, 'POST', `/api/task-lists/${seg(taskListId)}/tasks`, { name, position });

module.exports = {
  POSITION_GAP,
  PlankaError,
  TermsAcceptanceRequiredError,
  login,
  getMe,
  getProjects,
  getBoard,
  createBoard,
  createList,
  createLabel,
  createCard,
  updateCard,
  addCardLabel,
  removeCardLabel,
  createTaskList,
  createTask,
};
