/** Как часто спрашиваем сервер о новом: реже — переписка отстаёт, чаще — шум. */
export const POLL_MS = 5000;

/** Время сообщения — только часы и минуты: дату несёт порядок ленты. */
export const messageTime = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

const day = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });

/** В списке чатов: сегодняшнее — временем, остальное — датой. */
export function chatStamp(iso) {
  const at = new Date(iso);
  const today = new Date();
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate();

  return sameDay ? messageTime.format(at) : day.format(at);
}
