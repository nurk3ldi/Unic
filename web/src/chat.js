/** Как часто спрашиваем сервер о новом: реже — переписка отстаёт, чаще — шум. */
export const POLL_MS = 5000;

/** Время сообщения — только часы и минуты: дату несёт порядок ленты. */
export const messageTime = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});
