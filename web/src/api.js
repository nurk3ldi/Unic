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
  pinChat: (id, pinned) => request(`/clubs/${id}/chat-pin`, { method: 'PUT', body: { pinned } }),

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
  // before — id самого старого из показанных: следующая страница истории
  clubMessages: (id, before) =>
    request(`/clubs/${id}/messages${before ? `?before=${before}` : ''}`),
  searchClubMessages: (id, q) =>
    request(`/clubs/${id}/messages/search?q=${encodeURIComponent(q)}`),
  // pinned: false — снять закрепление
  pinClubMessage: (id, messageId, pinned = true) =>
    request(`/clubs/${id}/pin`, { method: 'PUT', body: { messageId, pinned } }),
  // Ответа нет: сообщение о наборе живёт только в чужой ленте
  typing: (id) => request(`/clubs/${id}/typing`, { method: 'POST' }),
  markChatRead: (id, messageId) =>
    request(`/clubs/${id}/read`, { method: 'PUT', body: { messageId } }),
  chatsUnread: () => request('/chats/unread'),
  sendClubMessage: (id, payload) =>
    request(`/clubs/${id}/messages`, { method: 'POST', body: payload }),
  deleteClubMessage: (id, messageId) =>
    request(`/clubs/${id}/messages/${messageId}`, { method: 'DELETE' }),
  // emoji: null — убрать свою реакцию
  reactToMessage: (id, messageId, emoji) =>
    request(`/clubs/${id}/messages/${messageId}/reaction`, { method: 'PUT', body: { emoji } }),

  /**
   * Вложение чата — сам файл телом запроса. Здесь XMLHttpRequest, а не fetch:
   * только он сообщает ход отправки, а видео в десятки мегабайт без полосы
   * хода выглядит зависшим. Имя — в заголовке, закодированным: заголовки не
   * несут кириллицу. `onProgress` получает долю от 0 до 1.
   */
  uploadChatFile: (id, file, meta = {}, onProgress, signal) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/clubs/${id}/files`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
      if (meta.width) xhr.setRequestHeader('X-Video-Width', String(meta.width));
      if (meta.height) xhr.setRequestHeader('X-Video-Height', String(meta.height));
      if (meta.duration) {
        // Длительность — и видео, и аудио: сервер берёт ту, что относится к виду файла
        xhr.setRequestHeader('X-Video-Duration', String(meta.duration));
        xhr.setRequestHeader('X-Audio-Duration', String(meta.duration));
      }
      // Голосовое, записанное в чате, и его «волна» для столбиков в ленте
      if (meta.voice) xhr.setRequestHeader('X-Voice', '1');
      if (meta.waveform?.length) xhr.setRequestHeader('X-Voice-Waveform', meta.waveform.join(','));

      // Передумали — обрываем и сам запрос: незачем догружать то, что уже не нужно.
      // Сервер удалит недописанный файл сам (saveBody чистит за собой)
      const stop = () => xhr.abort();
      signal?.addEventListener('abort', stop);
      xhr.onloadend = () => signal?.removeEventListener('abort', stop);
      xhr.onabort = () => reject(new DOMException('Отправка отменена', 'AbortError'));

      xhr.upload.onprogress = (event) =>
        event.lengthComputable && onProgress?.(event.loaded / event.total);
      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          // пустой или не JSON ответ — ниже обычное сообщение об ошибке
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error ?? 'Не удалось загрузить файл'));
      };
      xhr.onerror = () => reject(new Error('Не удалось загрузить файл'));
      xhr.send(file);
    }),

  posts: () => request('/posts'),
  postTargets: () => request('/posts/targets'),
  createPost: (body) => request('/posts', { method: 'POST', body }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
  likePost: (id, liked) => request(`/posts/${id}/like`, { method: 'PUT', body: { liked } }),
  stories: () => request('/stories'),
  deleteStory: (id) => request(`/stories/${id}`, { method: 'DELETE' }),
  viewStory: (id) => request(`/stories/${id}/view`, { method: 'PUT' }),
  storyViews: (id) => request(`/stories/${id}/views`),
  likeStory: (id, liked) => request(`/stories/${id}/like`, { method: 'PUT', body: { liked } }),
  // Ответ уходит в личный чат с рассказчиком; в ответе — id этого чата
  replyToStory: (id, text) => request(`/stories/${id}/replies`, { method: 'POST', body: { text } }),

  /** История уходит тем же путём, что и вложение чата: тело запроса — сам файл. */
  uploadStory: (file, clubId, meta = {}) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/stories');
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
      if (clubId) xhr.setRequestHeader('X-Club-Id', clubId);
      if (meta.width) xhr.setRequestHeader('X-Video-Width', String(meta.width));
      if (meta.height) xhr.setRequestHeader('X-Video-Height', String(meta.height));
      if (meta.duration) xhr.setRequestHeader('X-Video-Duration', String(meta.duration));

      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          // пустой или не JSON ответ — ниже обычное сообщение об ошибке
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error ?? 'Не удалось выложить историю'));
      };
      xhr.onerror = () => reject(new Error('Не удалось выложить историю'));
      xhr.send(file);
    }),
};
