/** Единственная точка сетевых запросов. Компоненты не вызывают fetch напрямую. */
async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Не удалось выполнить запрос');
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  forgot: (payload) => request('/auth/forgot', { method: 'POST', body: payload }),
  verifyCode: (payload) => request('/auth/verify-code', { method: 'POST', body: payload }),
  reset: (payload) => request('/auth/reset', { method: 'POST', body: payload }),

  clubs: () => request('/clubs'),
  createClub: (payload) => request('/clubs', { method: 'POST', body: payload }),
};
