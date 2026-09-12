// Companion sunucusuyla konusan ince katman.
// Oturum httpOnly cerezde tutuldugu icin ayrica token tasimaya gerek yok.

export class ApiError extends Error {
  constructor(status, payload) {
    super((payload && (payload.message || payload.error)) || `Istek basarisiz (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload || {};
  }
}

async function request(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 200) };
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload;
}

export const api = {
  login: (emailOrUsername, password) =>
    request('POST', '/api/auth/login', { emailOrUsername, password }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),

  hub: () => request('GET', '/api/hub'),
  board: (boardId) => request('GET', `/api/boards/${boardId}`),

  addLabel: (cardId, labelId) => request('POST', `/api/cards/${cardId}/labels`, { labelId }),
  removeLabel: (cardId, labelId) => request('DELETE', `/api/cards/${cardId}/labels/${labelId}`),
  moveCard: (cardId, boardId, listId, index) =>
    request('PATCH', `/api/cards/${cardId}/move`, { boardId, listId, index }),

  setStartDate: (cardId, boardId, startDate) =>
    request('PUT', `/api/cards/${cardId}/start-date`, { boardId, startDate }),
  setDueDate: (cardId, dueDate) => request('PUT', `/api/cards/${cardId}/due-date`, { dueDate }),

  templates: () => request('GET', '/api/templates'),
  saveTemplate: (boardId, name, description) =>
    request('POST', '/api/templates', { boardId, name, description }),
  renameTemplate: (id, name, description) =>
    request('PATCH', `/api/templates/${id}`, { name, description }),
  deleteTemplate: (id) => request('DELETE', `/api/templates/${id}`),
  instantiateTemplate: (id, options) => request('POST', `/api/templates/${id}/instantiate`, options),
};
