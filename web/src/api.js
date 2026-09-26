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
  setPhoto: (photo) => request('/auth/photo', { method: 'PUT', body: { photo } }),
  updateMe: (payload) => request('/auth/me', { method: 'PATCH', body: payload }),
  changePassword: (payload) => request('/auth/password', { method: 'POST', body: payload }),
  startEmailChange: (payload) => request('/auth/email', { method: 'POST', body: payload }),
  confirmEmailChange: (code) => request('/auth/email/confirm', { method: 'POST', body: { code } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  forgot: (payload) => request('/auth/forgot', { method: 'POST', body: payload }),
  verifyCode: (payload) => request('/auth/verify-code', { method: 'POST', body: payload }),
  reset: (payload) => request('/auth/reset', { method: 'POST', body: payload }),

  clubs: () => request('/clubs'),
  clubStats: () => request('/clubs/stats'),
  club: (id) => request(`/clubs/${id}`),
  createClub: (payload) => request('/clubs', { method: 'POST', body: payload }),
  updateClub: (id, payload) => request(`/clubs/${id}`, { method: 'PATCH', body: payload }),

  deleteClub: (id) => request(`/clubs/${id}`, { method: 'DELETE' }),

  clubMembers: (id) => request(`/clubs/${id}/members`),
  clubCandidates: (id, text) => request(`/clubs/${id}/candidates?q=${encodeURIComponent(text)}`),
  inviteMember: (id, payload) => request(`/clubs/${id}/members`, { method: 'POST', body: payload }),
  invites: () => request('/invites'),
  acceptInvite: (clubId) => request(`/invites/${clubId}/accept`, { method: 'POST' }),
  declineInvite: (clubId) => request(`/invites/${clubId}/decline`, { method: 'POST' }),
  updateClubMember: (id, userId, payload) =>
    request(`/clubs/${id}/members/${userId}`, { method: 'PATCH', body: payload }),
  removeClubMember: (id, userId) =>
    request(`/clubs/${id}/members/${userId}`, { method: 'DELETE' }),

  chats: () => request('/chats'),
  clubMedia: (id) => request(`/clubs/${id}/media`),
  setChatNotifications: (id, enabled) =>
    request(`/clubs/${id}/notifications`, { method: 'PUT', body: { enabled } }),

  // Без промежутка — ближайшие; с промежутком — всё в нём (для календаря)
  events: (range) =>
    request(
      range
        ? `/events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
        : '/events',
    ),
  clubEvents: (id) => request(`/clubs/${id}/events`),
  createClubEvent: (id, payload) =>
    request(`/clubs/${id}/events`, { method: 'POST', body: payload }),
  deleteClubEvent: (id, eventId) =>
    request(`/clubs/${id}/events/${eventId}`, { method: 'DELETE' }),
  clubMessages: (id) => request(`/clubs/${id}/messages`),
  sendClubMessage: (id, payload) =>
    request(`/clubs/${id}/messages`, { method: 'POST', body: payload }),
  deleteClubMessage: (id, messageId) =>
    request(`/clubs/${id}/messages/${messageId}`, { method: 'DELETE' }),
};
