/** Дата события плашкой: число и месяц отдельно («2» и «окт»). */
export const eventDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' });
export const eventMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

/** Время события: «15:00». */
export const eventTime = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

/** День события словами: «5 ноября»; чужой год дописывается («5 ноября 2027 г.»). */
const thisYear = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const otherYear = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export function eventDate(date) {
  return (date.getFullYear() === new Date().getFullYear() ? thisYear : otherYear).format(date);
}
