/** Как часто спрашиваем сервер о новом: реже — переписка отстаёт, чаще — шум. */
export const POLL_MS = 5000;

/**
 * Пока жив поток событий (`live.js`), опрос нужен только на случай обрыва —
 * раз в полминуты. Оборвалось — возвращаемся к частому.
 */
export const SLOW_POLL_MS = 30_000;

/** Как часто говорить серверу «я набираю»: чаще незачем, событие живёт дольше. */
export const TYPING_EVERY_MS = 3000;

/** Сколько держать чужое «набирает», если новых знаков от него не пришло. */
export const TYPING_SHOWN_MS = 5000;

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
 * Быстрые реакции — первый ряд меню сообщения. Остальные — в окне «+»
 * (`emoji.js`); сервер принимает любой настоящий эмодзи. Один человек — одна
 * реакция на сообщение.
 */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/**
 * Реакции после того, как человек сменил свою: `from` убирается, `to` ставится
 * (null — ничего), новая — в конец, как её поставит и сервер (порядок — по
 * первой реакции). Для мгновенного отклика, пока сервер не ответил.
 */
export function swapReaction(reactions, name, from, to) {
  let list = reactions
    .map((item) =>
      item.emoji === from
        ? { ...item, count: item.count - 1, mine: false, names: item.names.filter((who) => who !== name) }
        : item,
    )
    .filter((item) => item.count > 0);
  if (to) {
    list = list.some((item) => item.emoji === to)
      ? list.map((item) =>
          item.emoji === to
            ? { ...item, count: item.count + 1, mine: true, names: [...item.names, name] }
            : item,
        )
      : [...list, { emoji: to, count: 1, mine: true, names: [name] }];
  }
  return list;
}

/**
 * Ссылка в тексте: до пробела, без хвостовой пунктуации предложения.
 * Тот же шаблон собирает раздел «Медиа» на сервере — что подсвечено, то и собрано.
 */
export const LINK_RE = /https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/g;

/**
 * Упоминание: `@ник` — ровно те же символы, что и в нике при регистрации.
 * Слева не буква, не `@` и не точка — иначе адрес почты `имя@ник.kz` читался бы
 * как упоминание. Справа граница по латинице: `@aruzhan-ға` и `@aruzhan,` —
 * это она, а `@aruzhan_bek` — уже другой человек.
 *
 * **Тот же шаблон живёт на сервере** (SQL, в списке чатов): что подсвечено
 * в ленте, о том и приходит оповещение.
 */
export const MENTION_RE = /(?<![a-z0-9_@.])@([a-z0-9_]{3,20})(?![a-z0-9_])/gi;

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

/**
 * Как назвать сообщение там, где видна одна строка (цитата, список чатов,
 * оповещение): текст, а без текста — что в нём лежит.
 */
export function messageLabel(message) {
  if (message.deleted) return 'Сообщение удалено';
  if (message.text) return message.text;
  if (message.photo || message.file?.kind === 'image') return 'Фото';
  if (message.file?.kind === 'video') return 'Видео';
  if (message.file?.kind === 'voice') return 'Голосовое сообщение';
  if (message.file) return message.file.name;
  return '';
}

/** Размер файла по-человечески: «340 КБ», «5,2 МБ». */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  const [value, unit] = bytes < 1024 * 1024 ? [bytes / 1024, 'КБ'] : [bytes / 1024 / 1024, 'МБ'];
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${unit}`;
}

/** Длительность видео: «0:12», «1:04:30». */
export function formatDuration(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// Что можно приложить — тот же список, что проверяет сервер (server/src/files.js).
// Проверяем и здесь: большой файл лучше остановить до загрузки, а не после
export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'mov'];
export const DOCUMENT_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  'rtf', 'txt', 'csv', 'zip', 'rar', '7z',
  // iWork от Apple — только скачать: ни один браузер их не открывает
  'pages', 'numbers', 'key',
];
// Аудиофайлы — тот же список, что на сервере. Голосовое пишется прямо в чате (voice.js)
export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac'];
export const AUDIO_LIMIT = 25 * 1024 * 1024;
// Снимки Apple: Safari их читает и сам переведёт в JPEG; остальные отправят оригиналом
export const IMAGE_EXTENSIONS = ['heic', 'heif'];
export const VIDEO_LIMIT = 100 * 1024 * 1024;
export const DOCUMENT_LIMIT = 25 * 1024 * 1024;
export const IMAGE_LIMIT = 25 * 1024 * 1024;

/** Расширение файла без точки, строчными. */
export const extensionOf = (name) =>
  name.includes('.') ? name.split('.').pop().toLowerCase() : '';
