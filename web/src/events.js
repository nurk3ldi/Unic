/** Как проект показывает дату события: число и месяц отдельно — для плашки. */
export const eventDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' });
export const eventMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

/** «2 октября, 15:00» — одной строкой, когда плашки нет. */
export const eventWhen = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export const eventTime = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});
