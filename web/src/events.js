/** Дата события плашкой: число и месяц отдельно («2» и «окт»). */
export const eventDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' });
export const eventMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

/** Время события: «15:00». */
export const eventTime = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});
