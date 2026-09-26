/** Как часто спрашиваем сервер о новом: реже — переписка отстаёт, чаще — шум. */
export const POLL_MS = 5000;

/** Время сообщения — только часы и минуты: дату несёт порядок ленты. */
export const messageTime = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

const day = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dayMonthYear = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Один ли это календарный день — по местному времени, а не по UTC. */
export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/** Разделитель дней в ленте: «Сегодня», «Вчера», дальше дата; год — только чужой. */
export function dayLabel(iso) {
  const at = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(at, today)) return 'Сегодня';
  if (sameDay(at, yesterday)) return 'Вчера';
  return (at.getFullYear() === today.getFullYear() ? dayMonth : dayMonthYear).format(at);
}

/**
 * Ссылка в тексте: до пробела, без хвостовой пунктуации предложения.
 * Тот же шаблон собирает раздел «Медиа» на сервере — что подсвечено, то и собрано.
 */
export const LINK_RE = /https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/g;

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
