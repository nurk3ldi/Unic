import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowDown,
  IconArrowUp,
  IconBan,
  IconCheck,
  IconCheckDouble,
  IconChevronDown,
  IconChevronUp,
  IconClose,
  IconCopy,
  IconDocument,
  IconDownload,
  IconImage,
  IconImages,
  IconMic,
  IconMusic,
  IconPin,
  IconPinSolid,
  IconPlay,
  IconPlus,
  IconReply,
  IconSearch,
  IconTrash,
  IconUpload,
  IconVideo,
} from '../icons.jsx';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import {
  DOCUMENT_EXTENSIONS,
  DOCUMENT_LIMIT,
  IMAGE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  AUDIO_LIMIT,
  IMAGE_LIMIT,
  LINK_RE,
  MENTION_RE,
  POLL_MS,
  REACTIONS,
  SLOW_POLL_MS,
  TYPING_EVERY_MS,
  TYPING_SHOWN_MS,
  VIDEO_EXTENSIONS,
  VIDEO_LIMIT,
  dayLabel,
  extensionOf,
  formatDuration,
  formatSize,
  messageLabel,
  messageTime,
  sameDay,
  swapReaction,
} from '../chat.js';
import { authorColor, formatPhone, initial, shortName } from '../people.js';
import { chatPhoto } from '../photo.js';
import { useLive } from '../live.js';
import { canRecord, useVoiceRecorder } from '../voice.js';
import ChatAudio from './ChatAudio.jsx';
import SearchField from './SearchField.jsx';
import EmojiPicker from './EmojiPicker.jsx';
import PhotoViewer from './PhotoViewer.jsx';
import './ChatRoom.css';

// Кто убрал сообщение — словом, в той роли, в какой убирал
const DELETED_AS = {
  lead: 'лидером клуба',
  university: 'университетом',
  admin: 'администратором',
};

/**
 * Что написать на месте удалённого. Убрал сам автор — просто «удалено»;
 * убрал модератор — кто именно: так видно, что это не автор передумал.
 * У университета имя — название, его не сокращаем.
 */
function deletedText(deleted, own) {
  if (deleted.as === 'author') return own ? 'Вы удалили сообщение' : 'Сообщение удалено';
  const who = deleted.by
    ? ` · ${deleted.as === 'university' ? deleted.by : shortName(deleted.by)}`
    : '';
  return `Сообщение удалено ${DELETED_AS[deleted.as]}${who}`;
}

// Что предлагает системное окно выбора: снимки и видео — одним пунктом, документы — другим
const MEDIA_ACCEPT = `image/*,${[...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]
  .map((ext) => `.${ext}`)
  .join(',')}`;
const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',');
const AUDIO_ACCEPT = AUDIO_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/** Длительность аудиофайла — браузер читает её до отправки. Не прочиталась — без неё. */
function readAudio(url) {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () =>
      resolve(Number.isFinite(audio.duration) ? { duration: audio.duration } : {});
    audio.onerror = () => resolve({});
    audio.src = url;
  });
}

/**
 * Размер кадра и длительность видео — браузер читает их из самого файла до
 * отправки: место под видео в ленте известно заранее, и она не прыгает.
 * Не прочиталось (редкий кодек) — отправляем без них, лента возьмёт 16:9.
 */
function readVideo(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
    video.onerror = () => resolve({});
    video.src = url;
  });
}

/**
 * Вложение, которое этот браузер показать не может (HEIC или HEVC-видео с iPhone
 * в Chrome на Windows). Пузырь не ломается: говорит, в чём дело, где откроется
 * и даёт скачать.
 */
function Unplayable({ file, what }) {
  return (
    <div className="msg__unplayable">
      <span className="msg__file-icon" aria-hidden="true">
        {what === 'Видео' ? (
          <IconVideo />
        ) : what === 'Аудио' ? (
          <IconMusic />
        ) : (
          <IconImage />
        )}
      </span>
      <span className="msg__file-body">
        <span className="msg__file-name">{what} не открывается в этом браузере</span>
        <span className="msg__unplayable-hint">Откройте в Safari или скачайте файл</span>
        <a className="msg__unplayable-download" href={file.url} download={file.name}>
          <IconDownload aria-hidden="true" />
          Скачать · {extensionOf(file.name).toUpperCase()} · {formatSize(file.size)}
        </a>
      </span>
    </div>
  );
}

/**
 * Видео в ленте — как в «Сообщениях»: первый кадр, по центру круглая ▶ из
 * матового стекла, в углу длительность. Нажатие открывает свой плеер на весь
 * экран (PhotoViewer). Системных кнопок браузера в ленте нет.
 *
 * Не прочиталось — Unplayable. Кодек, которого браузер не знает, бывает двух
 * видов: сразу ошибка, либо «открылось», но без картинки (ширина кадра 0 —
 * только звук). Оба — как «не открывается».
 */
function ChatVideo({ file, time, onOpen }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Unplayable file={file} what="Видео" />;

  return (
    /* Место под кадр известно заранее — лента не прыгает, пока он грузится */
    <button
      className="msg__video"
      type="button"
      aria-label="Смотреть видео"
      style={{
        aspectRatio: file.width && file.height ? `${file.width} / ${file.height}` : '16 / 9',
      }}
      onClick={() => onOpen({ url: file.url, kind: 'video', name: file.name, duration: file.duration })}
    >
      {/* #t=0.1 — браузер показывает кадр, а не чёрный прямоугольник */}
      <video
        src={`${file.url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        onError={() => setFailed(true)}
        onLoadedMetadata={(event) => event.currentTarget.videoWidth === 0 && setFailed(true)}
      />

      <span className="msg__video-play" aria-hidden="true">
        <IconPlay />
      </span>

      {file.duration && <span className="msg__video-duration">{formatDuration(file.duration)}</span>}
      {time}
    </button>
  );
}

/**
 * Снимок Apple оригиналом (HEIC). Размер кадра заранее неизвестен — место держим
 * 3:4, как у снимка с iPhone, и подстраиваем, когда он загрузился. Не прочитался —
 * Unplayable.
 */
function ChatImage({ file, time, onOpen }) {
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState('3 / 4');
  if (failed) return <Unplayable file={file} what="Фото" />;

  return (
    <button
      className="msg__photo"
      type="button"
      aria-label="Открыть фото"
      style={{ aspectRatio: ratio }}
      onClick={() => onOpen({ url: file.url })}
    >
      <img
        src={file.url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        onLoad={(event) =>
          setRatio(`${event.currentTarget.naturalWidth} / ${event.currentTarget.naturalHeight}`)
        }
      />
      {time}
    </button>
  );
}

// Сколько места нужно меню сообщения под кнопкой (три строки по 44px и поля), в rem:
// меньше — и оно раскрывается вверх, иначе край ленты его обрежет
const MENU_ROOM_REM = 14;

/** Текст с живыми ссылками: адрес открывается в новой вкладке, разговор остаётся. */
/**
 * Пока набирают ник: `@` и то, что успели написать, у самого курсора.
 * В набранном допустимы любые буквы, хотя ник — только латиница: у нас ищут
 * и по имени, а имена здесь казахские («@нұр» находит Нұркелді). Подставится
 * всё равно ник.
 */
const TYPING_MENTION = /(?:^|[^a-z0-9_@.])@([\p{L}0-9_]{0,20})$/iu;

/**
 * Текст реплики: ссылки открываются, `@ник` подсвечен. Оба разбора — одним
 * проходом по строке: вложенные split'ы путали бы порядок кусков.
 *
 * `mentionClass` решает, упоминание ли это: набор букв после `@`, за которым
 * в клубе никого нет, остаётся обычным текстом — подсветка обещает человека.
 */
function withRich(text, mentionClass) {
  const rich = new RegExp(`(${LINK_RE.source})|${MENTION_RE.source}`, 'gi');
  const parts = [];
  let from = 0;

  for (const found of text.matchAll(rich)) {
    const [whole, link, nick] = found;
    const style = link ? null : mentionClass(nick);
    if (!link && !style) continue;

    if (found.index > from) parts.push(text.slice(from, found.index));
    parts.push(
      link ? (
        <a key={parts.length} className="msg__link" href={whole} target="_blank" rel="noreferrer">
          {whole}
        </a>
      ) : (
        <span key={parts.length} className={style}>
          {whole}
        </span>
      ),
    );
    from = found.index + whole.length;
  }

  parts.push(text.slice(from));
  return parts;
}

/**
 * Подсветить в уже разобранном тексте то, что искали.
 *
 * Работает поверх `withRich`, по готовым кускам: ссылку и упоминание не трогаем —
 * они уже элементы, и метка внутри них разорвала бы адрес. Значит, слово внутри
 * ссылки не подсветится — там оно и не читается как слово.
 */
export function withMark(parts, query) {
  if (!query) return parts;

  // Искали текст, а не шаблон: точка, скобка и прочее — обычные символы
  const cut = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const out = [];

  for (const part of parts) {
    if (typeof part !== 'string') {
      out.push(part);
      continue;
    }

    // split с группой кладёт найденное на нечётные места
    part.split(cut).forEach((piece, index) => {
      if (!piece) return;
      out.push(
        index % 2 ? (
          <mark key={`m${out.length}`} className="chat__mark">
            {piece}
          </mark>
        ) : (
          piece
        ),
      );
    });
  }

  return out;
}

/**
 * Время реплики, а у своей — ещё и судьба: ✓ дошло, ✓✓ прочитали **все**
 * остальные участники (WhatsApp читает их так же). Одна дата на всю ленту —
 * `readByAll`: своё сообщение не новее её, значит его успели прочитать все.
 *
 * Университет и админ в составе не числятся и в счёт не идут — иначе «все»
 * означало бы «и те, кто просто смотрит чужой клуб».
 */
function Stamp({ message, own, readByAll, className = 'msg__time' }) {
  const read = readByAll && new Date(message.createdAt) <= new Date(readByAll);
  return (
    <time className={className} dateTime={message.createdAt}>
      {messageTime.format(new Date(message.createdAt))}
      {own &&
        !message.deleted &&
        (read ? (
          <IconCheckDouble className="msg__ticks msg__ticks--read" aria-label="Прочитано" />
        ) : (
          <IconCheck className="msg__ticks" aria-label="Отправлено" />
        ))}
    </time>
  );
}

/**
 * Кружок автора у реплики: снимок, если он есть, иначе буква его цвета.
 * Снимок приходит ссылкой (`/api/users/:id/photo`) — браузер берёт его один раз
 * и держит в кэше, а не тянет байты с каждым опросом.
 *
 * `voice` — у голосового аватар уже внутри пузыря (с микрофоном): внешний
 * прячем, но место держим, иначе пузырь выпал бы из общего ряда.
 */
function Avatar({ message, voice = false }) {
  return (
    <span className={`msg__avatar${voice ? ' msg__avatar--hidden' : ''}`} aria-hidden="true">
      {message.authorPhoto ? (
        <img src={message.authorPhoto} alt="" />
      ) : (
        initial(message.author)
      )}
    </span>
  );
}

/**
 * Разговор одного клуба: лента и поле ввода.
 *
 * **Новое приходит опросом, а не сокетом.** Пять секунд для клубной переписки
 * незаметны, а WebSocket — это новая зависимость и своё состояние соединения;
 * §2 держит список закрытым, и пока цена не оправдана. Опрос останавливается,
 * когда вкладка скрыта: незачем будить сервер ради невидимого экрана.
 *
 * Лента всегда прокручена к последнему сообщению — читают её с конца.
 */
export default function ChatRoom({ clubId, members = [], jump = null }) {
  const { user } = useAuth();

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const documentRef = useRef(null);
  const audioRef = useRef(null);
  // Превью держит последнее вложение, пока полоса сворачивается, — иначе
  // оно исчезло бы раньше, чем закрылось место под него
  const shownPhoto = useRef(null);
  const shownAttachment = useRef(null);

  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false); // раньше показанного есть ещё история
  const [pinned, setPinned] = useState([]); // закреплённые сообщения клуба
  const [pinAt, setPinAt] = useState(0); // какое из них показывает полоска
  const [readByAll, setReadByAll] = useState(null); // до какой даты чат прочитан всеми
  const [jumping, setJumping] = useState(false); // идём к старому сообщению
  const [typing, setTyping] = useState([]); // кто сейчас набирает: [{ id, name }]
  const reload = useRef(null); // перечитать ленту — по событию, а не по таймеру
  const typedAt = useRef(0); // когда последний раз сказали серверу «набираю»
  const typingOff = useRef({}); // id → таймер, который уберёт «набирает»
  const goTo = useRef(null); // id, к которому прокрутить после отрисовки
  // Что и где подсветить: { id сообщения, query }. Держится до следующего перехода —
  // слово, ради которого сюда пришли, не должно гаснуть, пока его читают
  const [mark, setMark] = useState(null);
  // Шаги по находкам: { query, list — снимок находок, at — номер текущей }.
  // Список свой, а не тот, что в панели: пока ходишь по находкам, в поле можно
  // набрать другое, и панельный список уже не про эти шаги
  const [nav, setNav] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // До какого момента был прочитан чат, когда его открыли: по нему — черта «Новые».
  // Берётся один раз: пока чат открыт, черта не ползёт вслед за чтением
  const [readMark, setReadMark] = useState(null);
  const [showDown, setShowDown] = useState(false); // ушли читать историю — видна ↓
  // До какого сообщения человек видел конец ленты (время). Всё чужое новее —
  // «ниже, не прочитано»: это число и стоит на кнопке ↓, как в Telegram
  const [seenAt, setSeenAt] = useState(null);
  // Можно ли убирать чужие сообщения: университет, админ, лидер этого клуба (решает сервер)
  const [canModerate, setCanModerate] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // id сообщения
  const [menuUp, setMenuUp] = useState(false); // снизу нет места — меню раскрывается вверх
  // Все эмодзи: { id сообщения, anchor — где стояла кнопка «+» }
  const [picker, setPicker] = useState(null);
  // Набирают `@ник`: { query — что успели написать, from — где стоит сама «@» }
  const [mention, setMention] = useState(null);
  const [mentionAt, setMentionAt] = useState(0); // какая строка списка выбрана
  const caret = useRef(null); // куда вернуть курсор после подстановки ника
  const dismissed = useRef(null); // «@», список которого закрыли сами
  const [replying, setReplying] = useState(null); // сообщение, на которое отвечаем
  const [photo, setPhoto] = useState(null); // { dataUrl, width, height } — снимок к отправке
  // Видео или документ к отправке: { kind, file, name, size, preview?, width?, height?, duration? }
  const [attachment, setAttachment] = useState(null);
  const [progress, setProgress] = useState(null); // доля загрузки 0…1, пока файл уходит
  const upload = useRef(null); // чем оборвать отправку файла, пока она идёт
  const [viewing, setViewing] = useState(null); // снимок, открытый на весь экран
  const [tall, setTall] = useState(false); // поле выросло больше одной строки
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    let first = true;
    setLoading(true);

    async function load() {
      if (document.hidden) return;
      try {
        const data = await api.clubMessages(clubId);
        if (alive) {
          // Опрос приносит последние 50. Историю, подгруженную выше, не выбрасываем:
          // оставляем всё, что старше самого старого из пришедших
          setMessages((was) => {
            const oldest = data.messages[0];
            if (!oldest) return data.messages;
            const older = was.filter(
              (item) => new Date(item.createdAt) < new Date(oldest.createdAt),
            );
            return [...older, ...data.messages];
          });
          setCanModerate(Boolean(data.canModerate));
          setPinned(data.pinned ?? []);
          setReadByAll(data.readByAll ?? null);
          // Первый ответ говорит, есть ли история раньше и до какого места прочитано
          // Updater выполняется позже этой строки — «первый ли ответ» фиксируем сейчас,
          // иначе к его запуску first уже false и история считалась бы исчерпанной
          if (first) {
            setHasMore(data.hasMore);
            setReadMark(data.lastReadAt);
            setSeenAt(data.lastReadAt);
          }
          first = false;
          setError('');
        }
      } catch (failure) {
        if (alive) setError(failure.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    reload.current = load;
    load();
    return () => {
      alive = false;
    };
  }, [clubId]);

  /**
   * События приходят сами (`live.js`): новое сообщение — перечитать ленту,
   * чужой набор — показать строку. Своё сообщение и свой набор до нас не
   * доходят, их и не ждём.
   */
  const live = useLive((event) => {
    if (event.clubId !== clubId) return;

    if (event.type === 'message') {
      // Написал — значит уже не набирает
      setTyping((was) => was.filter((item) => item.id !== event.userId));
      reload.current?.();
      return;
    }

    if (event.type === 'typing' && event.userId !== user?.id) {
      setTyping((was) =>
        was.some((item) => item.id === event.userId)
          ? was
          : [...was, { id: event.userId, name: event.name }],
      );
      // Знаки перестали приходить — строка гаснет сама
      clearTimeout(typingOff.current[event.userId]);
      typingOff.current[event.userId] = setTimeout(() => {
        setTyping((was) => was.filter((item) => item.id !== event.userId));
      }, TYPING_SHOWN_MS);
    }
  });

  // Опрос остался страховкой: пока поток жив — раз в полминуты, оборвался —
  // как прежде. Вкладку вернули — читаем сразу, не дожидаясь очереди
  useEffect(() => {
    const timer = setInterval(() => reload.current?.(), live ? SLOW_POLL_MS : POLL_MS);
    const onShow = () => !document.hidden && reload.current?.();
    document.addEventListener('visibilitychange', onShow);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [live]);

  // Ушли из разговора — чужие «набирает» не должны догнать нас позже
  useEffect(() => {
    const timers = typingOff.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  /** Сказать серверу, что набираем. Не чаще, чем событие успевает погаснуть. */
  function tellTyping() {
    const now = Date.now();
    if (now - typedAt.current < TYPING_EVERY_MS) return;
    typedAt.current = now;
    api.typing(clubId).catch(() => {});
  }

  // Меню закрывается кликом вне и клавишей Esc — как и остальные в проекте
  useEffect(() => {
    if (!attaching) return undefined;

    const close = () => setAttaching(false);
    const onKey = (event) => event.key === 'Escape' && close();

    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [attaching]);

  useEffect(() => {
    if (openMenu === null) return undefined;

    const close = () => setOpenMenu(null);
    const onKey = (event) => event.key === 'Escape' && close();

    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  // Кого этот `@ник` называет: свой ник — true, участник клуба — false,
  // никого — undefined. Своего держим отдельно: упоминание себя видно и тому,
  // кто состава не видит, — например университету, читающему чужой клуб
  const nicks = useMemo(() => {
    const known = new Map();
    for (const member of members) {
      if (member.username) known.set(member.username.toLowerCase(), false);
    }
    if (user?.username) known.set(user.username.toLowerCase(), true);
    return known;
  }, [members, user]);

  const mentionClass = (nick) => {
    const me = nicks.get(nick.toLowerCase());
    if (me === undefined) return null;
    return me ? 'msg__mention msg__mention--me' : 'msg__mention';
  };

  // Кого предложить под набранным `@…`: по нику или по имени. Себя не зовут
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return members
      .filter(
        (member) =>
          member.username &&
          member.id !== user?.id &&
          (!query ||
            member.username.includes(query) ||
            member.name.toLowerCase().includes(query)),
      )
      .slice(0, 6);
  }, [mention, members, user]);

  // Пустой список не перехватывает ни Enter, ни стрелки
  const picking = suggestions.length > 0;
  const at = Math.min(mentionAt, suggestions.length - 1);

  /**
   * Идёт ли набор ника у курсора — считаем по самому полю, а не по событию.
   *
   * Закрытый список сам не возвращается: `onSelect` приходит и на нажатие
   * клавиши, причём поле в этот миг ещё со старым текстом, — без памяти об
   * отказе список воскресал бы сразу после Esc и после выбора. Отказ забывается,
   * как только набор ника кончился: тогда следующий `@` снова откроет список.
   */
  function watchMention(field) {
    const cursor = field.selectionStart;
    const found =
      cursor === field.selectionEnd ? TYPING_MENTION.exec(field.value.slice(0, cursor)) : null;

    if (!found) {
      dismissed.current = null;
      setMention(null);
      return;
    }

    const from = cursor - found[1].length - 1;
    if (dismissed.current === from) return;
    setMention({ query: found[1], from });
    setMentionAt(0);
  }

  /** Убрать список, не подставляя ник: этот `@` человек закрыл сам. */
  function closeMention() {
    dismissed.current = mention.from;
    setMention(null);
  }

  /** Подставить ник вместо набранного `@…` и продолжить строку. */
  function pickMention(member) {
    const to = mention.from + 1 + mention.query.length;
    // Пробел после ника: следом пишут слова, а не продолжение имени
    caret.current = mention.from + member.username.length + 2;
    setText(`${text.slice(0, mention.from)}@${member.username} ${text.slice(to)}`);
    closeMention();
    inputRef.current?.focus();
  }

  // Курсор после подстановки — до отрисовки, иначе он на кадр уедет в конец строки
  useLayoutEffect(() => {
    if (caret.current === null) return;
    inputRef.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);

  /** Копирование подтверждает себя в самом меню: тостов в проекте нет. */
  async function copy(message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpenMenu(null);
      }, 900);
    } catch {
      setError('Не удалось скопировать');
      setOpenMenu(null);
    }
  }

  /**
   * Своя реакция: та же — снимается, другая — заменяет прежнюю. Лента меняется
   * сразу, ответ сервера потом ставит точное состояние (и чужие реакции тоже).
   */
  async function react(message, emoji) {
    setOpenMenu(null);
    const reactions = message.reactions ?? [];
    const mine = reactions.find((item) => item.mine)?.emoji ?? null;
    const next = mine === emoji ? null : emoji;
    const put = (list) =>
      setMessages((was) =>
        was.map((item) => (item.id === message.id ? { ...item, reactions: list } : item)),
      );

    put(swapReaction(reactions, user?.fullName, mine, next));
    try {
      const data = await api.reactToMessage(clubId, message.id, next);
      put(data.reactions);
    } catch (failure) {
      put(reactions);
      setError(failure.message);
    }
  }

  /** Закрепить сообщение или снять закрепление (`next = false`). */
  async function pin(messageId, next = true) {
    setOpenMenu(null);
    try {
      const data = await api.pinClubMessage(clubId, messageId, next);
      setPinned(data.pinned);
      // Список сдвинулся — начинаем полоску со свежего закрепления
      setPinAt(0);
    } catch (failure) {
      setError(failure.message);
    }
  }

  /**
   * Дойти до сообщения, даже если оно далеко в истории: подгружаем страницы
   * вверх, пока оно не окажется в ленте, и только потом рисуем — иначе лента
   * дёргалась бы на каждой странице. Прокрутку делает эффект: к этому моменту
   * сообщение уже на экране.
   */
  /** Перейти к находке под номером `index`: и подсветить, и запомнить шаг. */
  function goFound(list, index, query) {
    setNav({ list, at: index, query });
    jumpTo(list[index].id, query);
  }

  async function jumpTo(id, marked = null) {
    // Пришли из поиска — несём с собой слово; из закреплённого — гасим прежнее
    setMark(marked ? { id, query: marked } : null);
    // Уход не по находке (закреплённое) заканчивает и шаги по ним
    if (!marked) setNav(null);

    if (messages.some((item) => item.id === id)) {
      goTo.current = id;
      return;
    }

    setJumping(true);
    let list = messages;
    let more = hasMore;
    // Потолок: чат может быть длинным, а бесконечный цикл — нет
    for (let page = 0; more && page < 40; page += 1) {
      const data = await api.clubMessages(clubId, list[0].id);
      const known = new Set(list.map((item) => item.id));
      list = [...data.messages.filter((item) => !known.has(item.id)), ...list];
      more = data.hasMore;
      if (list.some((item) => item.id === id)) break;
    }

    setMessages(list);
    setHasMore(more);
    setJumping(false);
    goTo.current = id;
  }

  // Прокрутка к найденному — после того, как оно отрисовано. Подсветка гаснет
  // сама: она показывает, куда смотреть, а не остаётся меткой
  useEffect(() => {
    if (!goTo.current) return;
    const node = document.getElementById(`msg-${goTo.current}`);
    goTo.current = null;
    if (!node) return;

    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.classList.add('msg--found');
    // Таймер намеренно живёт сам по себе: опрос обновляет ленту каждые пять
    // секунд, и снятие подсветки в cleanup гасило бы его раньше срока —
    // подсветка тогда оставалась бы навсегда
    setTimeout(() => node.classList.remove('msg--found'), 1600);
  }, [messages]);

  // Из панели поиска пришла находка. Панель живёт в соседней колонке и о ленте
  // ничего не знает: она лишь говорит, куда идти, — каждый выбор новый объект,
  // поэтому повторный щелчок по той же находке снова сработает
  useEffect(() => {
    if (jump) goFound(jump.list, jump.at, jump.query);
    // goFound держит свежие messages; следить за ним здесь незачем
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  async function removeMessage(message) {
    setOpenMenu(null);
    try {
      // Сообщение не исчезает — становится строкой «удалено» на том же месте
      const { message: gone } = await api.deleteClubMessage(clubId, message.id);
      setMessages((was) => was.map((item) => (item.id === gone.id ? gone : item)));
      if (replying?.id === gone.id) setReplying(null);
    } catch (failure) {
      setError(failure.message);
    }
  }

  // Поле растёт вместе с текстом (до max-height в CSS, дальше — прокрутка).
  // До отрисовки: иначе один кадр строка стояла бы в старой высоте
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;

    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
    // Выше одной строки капсула становится карточкой — круглые торцы не для абзаца
    setTall(field.scrollHeight > parseFloat(getComputedStyle(field).minHeight) + 1);
  }, [text]);

  /** Enter отправляет, Shift+Enter переносит строку. Пока идёт набор IME, Enter — его. */
  function sendOnEnter(event) {
    // Пока открыт список ников, он и отвечает за стрелки и Enter: там сейчас
    // выбирают человека, а не заканчивают реплику
    if (picking) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : suggestions.length - 1;
        setMentionAt((was) => (Math.min(was, suggestions.length - 1) + step) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pickMention(suggestions[at]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMention();
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form.requestSubmit();
    }
  }

  // Лента живёт концом, но только пока человек сам у конца. Опрос каждые 5 секунд
  // отдаёт новый массив — если прокручивать на каждый, читающего историю
  // выдёргивало бы вниз. Поэтому движемся, только когда пришло новое последнее
  // сообщение, и только если человек не ушёл читать выше
  const atBottom = useRef(true);
  const lastId = messages.at(-1)?.id;
  const unreadLineRef = useRef(null);
  const firstScroll = useRef(true);
  const markedId = useRef(null); // до какого сообщения уже отмечено «прочитано»
  const olderFix = useRef(null); // высота ленты до подгрузки истории — чтобы не прыгнуть

  // Первое непрочитанное — чужое, не удалённое, новее отметки на момент открытия
  const firstUnreadId = useMemo(() => {
    if (!readMark) return null;
    const since = new Date(readMark);
    return (
      messages.find(
        (item) =>
          item.authorId !== user?.id && !item.deleted && new Date(item.createdAt) > since,
      )?.id ?? null
    );
  }, [messages, readMark, user?.id]);

  /** Отметить прочитанным всё до последнего — только когда конец и правда виден. */
  function markRead() {
    const last = messages.at(-1);
    if (!last || !atBottom.current || document.hidden || markedId.current === last.id) return;
    markedId.current = last.id;
    setSeenAt(last.createdAt);
    api.markChatRead(clubId, last.id).catch(() => {
      markedId.current = null; // не вышло — попробуем при следующем случае
    });
  }

  useEffect(() => {
    const list = listRef.current;
    if (!list || !lastId) return;

    // Открыли чат с непрочитанным — встаём на черту «Новые сообщения», а не в конец
    if (firstScroll.current) {
      firstScroll.current = false;
      if (unreadLineRef.current) {
        unreadLineRef.current.scrollIntoView({ block: 'start' });
        atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
        setShowDown(!atBottom.current);
        if (!atBottom.current) return;
      }
    }

    if (atBottom.current) {
      list.scrollTop = list.scrollHeight;
      markRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  // Сколько чужого ниже непрочитано: новее того, что человек видел у конца
  const newBelow = useMemo(() => {
    if (!seenAt) return 0;
    const since = new Date(seenAt);
    return messages.filter(
      (item) => item.authorId !== user?.id && !item.deleted && new Date(item.createdAt) > since,
    ).length;
  }, [messages, seenAt, user?.id]);

  // Подгрузили историю сверху — возвращаем взгляд на то же место: лента выросла
  // вверх ровно на высоту пришедшего
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !olderFix.current) return;
    list.scrollTop = list.scrollHeight - olderFix.current.height + olderFix.current.top;
    olderFix.current = null;
  }, [messages]);

  /** Следующая страница истории — когда доскроллили почти до верха. */
  async function loadOlder() {
    if (loadingOlder || !hasMore || !messages.length) return;
    const list = listRef.current;
    setLoadingOlder(true);
    try {
      const data = await api.clubMessages(clubId, messages[0].id);
      olderFix.current = { height: list.scrollHeight, top: list.scrollTop };
      setMessages((was) => {
        const known = new Set(was.map((item) => item.id));
        return [...data.messages.filter((item) => !known.has(item.id)), ...was];
      });
      setHasMore(data.hasMore);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoadingOlder(false);
    }
  }

  function trackBottom(event) {
    const list = event.currentTarget;
    // Запас в полстроки: «почти у конца» — тоже у конца
    atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    setShowDown(!atBottom.current);
    if (atBottom.current) markRead();
    // Почти у верха — подтягиваем историю заранее, до того как упрутся
    if (list.scrollTop < 300) loadOlder();
  }

  /** ↓ — к концу переписки, плавно: видно, что проехали, а не перескочили. */
  function toBottom() {
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }

  // Вкладку вернули — если конец виден, прочитанное отмечаем сразу
  useEffect(() => {
    const onVisible = () => !document.hidden && markRead();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  if (photo) shownPhoto.current = photo;
  if (attachment) shownAttachment.current = attachment;

  // Превью видео — адрес на файл в памяти браузера; отпускаем, когда он не нужен
  useEffect(() => {
    const url = attachment?.preview;
    return () => url && URL.revokeObjectURL(url);
  }, [attachment?.preview]);

  // Лента по дням: у каждого дня своя секция с датой наверху
  const days = [];
  for (const message of messages) {
    const current = days.at(-1);
    if (current && sameDay(current.at, message.createdAt)) current.messages.push(message);
    else
      days.push({
        key: new Date(message.createdAt).toDateString(),
        at: message.createdAt,
        messages: [message],
      });
  }

  /**
   * «Фото и видео»: снимок сжимается в браузере, видео уходит как есть. И то и
   * другое ждёт в поле ввода — к нему можно дописать подпись.
   */
  async function pickMedia(file) {
    const ext = extensionOf(file.name);
    if (VIDEO_EXTENSIONS.includes(ext)) return pickVideo(file);

    try {
      // Сжимаем и переводим в JPEG — так снимок увидят все. Safari умеет это и с HEIC
      setPhoto(await chatPhoto(file));
      setAttachment(null);
      setError('');
      inputRef.current?.focus();
    } catch {
      // HEIC, который этот браузер не читает, уходит оригиналом: увидят те, кто умеет
      if (IMAGE_EXTENSIONS.includes(ext)) return pickAppleImage(file);
      setError('Не удалось прочитать фото. Выберите JPEG, PNG или HEIC.');
    }
  }

  function pickAppleImage(file) {
    if (file.size > IMAGE_LIMIT) return setError('Фото больше 25 МБ');

    setAttachment({ kind: 'image', file, name: file.name, size: file.size });
    setPhoto(null);
    setError('');
    inputRef.current?.focus();
  }

  async function pickVideo(file) {
    // Большое останавливаем до загрузки: ждать минуту, чтобы услышать «нельзя», — обидно
    if (file.size > VIDEO_LIMIT) return setError('Видео больше 100 МБ — выберите покороче');

    const preview = URL.createObjectURL(file);
    const meta = await readVideo(preview);
    setAttachment({ kind: 'video', file, name: file.name, size: file.size, preview, ...meta });
    setPhoto(null);
    setError('');
    inputRef.current?.focus();
  }

  /** «Документ»: файл ждёт в поле ввода как есть, с именем и размером. */
  function pickDocument(file) {
    if (!DOCUMENT_EXTENSIONS.includes(extensionOf(file.name))) {
      return setError('Такой файл отправить нельзя: подойдут PDF, Word, Excel, PowerPoint, TXT, ZIP');
    }
    if (file.size > DOCUMENT_LIMIT) return setError('Документ больше 25 МБ');

    setAttachment({ kind: 'document', file, name: file.name, size: file.size });
    setPhoto(null);
    setError('');
    inputRef.current?.focus();
  }

  /** «Аудио»: файл ждёт в поле ввода, как документ; длительность браузер читает сам. */
  async function pickAudio(file) {
    if (!AUDIO_EXTENSIONS.includes(extensionOf(file.name))) {
      return setError('Такой файл отправить нельзя: подойдут MP3, M4A, AAC, WAV, OGG, FLAC');
    }
    if (file.size > AUDIO_LIMIT) return setError('Аудио больше 25 МБ');

    const url = URL.createObjectURL(file);
    const meta = await readAudio(url);
    URL.revokeObjectURL(url);
    setAttachment({ kind: 'audio', file, name: file.name, size: file.size, ...meta });
    setPhoto(null);
    setError('');
    inputRef.current?.focus();
  }

  /** Из системного окна выбора: взять файл и очистить поле — тот же файл можно выбрать снова. */
  const fromInput = (take) => (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) take(file);
  };

  /**
   * Файл, пришедший не из меню «+», а перетаскиванием или вставкой (Ctrl+V):
   * куда он пойдёт, решает тип — как если бы его выбрали нужным пунктом меню.
   */
  function takeFile(file) {
    const ext = extensionOf(file.name);
    if (VIDEO_EXTENSIONS.includes(ext)) return pickVideo(file);
    if (AUDIO_EXTENSIONS.includes(ext)) return pickAudio(file);
    if (DOCUMENT_EXTENSIONS.includes(ext)) return pickDocument(file);
    // Снимок из буфера (скриншот) приходит без расширения, но с типом image/*
    if (file.type.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)) return pickMedia(file);
    setError('Такой файл отправить нельзя');
  }

  /** Несколько файлов — берём первый: в сообщении одно вложение. */
  function takeFiles(files) {
    if (!files.length || recorder.recording) return;
    takeFile(files[0]);
    if (files.length > 1) setError('Прикреплён первый файл — отправляйте их по одному');
  }

  // ── Перетаскивание ──
  // Счётчик, а не флаг: dragenter/dragleave приходят и от вложенных элементов,
  // и зона гасла бы, едва курсор переходит с пузыря на пузырь
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const carriesFiles = (event) => event.dataTransfer?.types?.includes('Files');

  const dropZone = {
    onDragEnter(event) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver(event) {
      // Без preventDefault браузер не разрешит бросить сюда и откроет файл сам
      if (carriesFiles(event)) event.preventDefault();
    },
    onDragLeave(event) {
      if (!carriesFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    },
    onDrop(event) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      takeFiles([...event.dataTransfer.files]);
    },
  };

  // ── Вставка (Ctrl+V) ──
  // Слушаем документ, а не поле: скриншот вставляют, не целясь в поле ввода.
  // Текст вставляется как обычно — перехватываем, только когда в буфере файл
  useEffect(() => {
    function onPaste(event) {
      const files = [...(event.clipboardData?.files ?? [])];
      if (!files.length) return;
      event.preventDefault();
      takeFiles(files);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  // ── Голосовое ──
  // Пустое поле — вместо «отправить» микрофон; появилось что отправлять — снова «отправить»
  const recorder = useVoiceRecorder({ onLimit: () => sendVoice() });
  const hasContent = Boolean(text.trim() || photo || attachment);

  async function startVoice() {
    setError('');
    try {
      await recorder.start();
    } catch (failure) {
      setError(
        failure?.name === 'NotAllowedError'
          ? 'Нет доступа к микрофону — разрешите его в браузере'
          : 'Микрофон не найден или занят',
      );
    }
  }

  /** Закончить запись и сразу отправить — как «отправить» у текста. */
  async function sendVoice() {
    if (sending) return;
    const voice = await recorder.finish();
    // Случайное касание — не сообщение: меньше секунды не отправляем
    if (!voice || voice.duration < 1) return;

    setSending(true);
    try {
      const { file } = await api.uploadChatFile(clubId, voice.file, {
        voice: true,
        duration: voice.duration,
        waveform: voice.waveform,
      });
      const { message } = await api.sendClubMessage(clubId, {
        text: '',
        replyTo: replying?.id ?? null,
        fileId: file.id,
      });
      atBottom.current = true;
      setShowDown(false);
      setMessages((was) => [...was, message]);
      setReplying(null);
      setError('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
    }
  }

  // Esc во время записи — отмена, как у любого начатого действия
  useEffect(() => {
    if (!recorder.recording) return undefined;
    const onKey = (event) => event.key === 'Escape' && recorder.cancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  async function send(event) {
    event.preventDefault();

    const body = text.trim();
    if ((!body && !photo && !attachment) || sending) return;

    setSending(true);
    try {
      // Вложение сначала ложится на сервер (с полосой хода), потом им отправляют сообщение
      let fileId = null;
      if (attachment) {
        setProgress(0);
        upload.current = new AbortController();
        const { file } = await api.uploadChatFile(
          clubId,
          attachment.file,
          { width: attachment.width, height: attachment.height, duration: attachment.duration },
          setProgress,
          upload.current.signal,
        );
        fileId = file.id;
      }

      const { message } = await api.sendClubMessage(clubId, {
        text: body,
        replyTo: replying?.id ?? null,
        photo: photo?.dataUrl ?? null,
        photoWidth: photo?.width ?? null,
        photoHeight: photo?.height ?? null,
        fileId,
      });
      // Своё сообщение показываем сразу, не дожидаясь следующего опроса,
      // и к нему ведём всегда — даже если перед этим читали историю
      atBottom.current = true;
      setShowDown(false);
      setMessages((was) => [...was, message]);
      setText('');
      setReplying(null);
      setPhoto(null);
      setAttachment(null);
      setError('');
    } catch (failure) {
      // Оборвали сами — это не ошибка: убираем вложение и молчим
      if (failure.name === 'AbortError') setAttachment(null);
      else setError(failure.message);
    } finally {
      upload.current = null;
      setProgress(null);
      setSending(false);
      inputRef.current?.focus();
    }
  }

  /** Одна реплика ленты: пузырь, её шапка, меню. Удалённая — тихой строкой. */
  function renderMessage(message) {
    const own = message.authorId === user?.id;

    // Удалённое — тихой строкой на своём месте: разговор не рвётся,
    // и видно, кто убрал. Меню у неё нет — делать с ней нечего
    if (message.deleted) {
      return (
        <div
          className={`msg${own ? ' msg--own' : ''}`}
          id={`msg-${message.id}`}
          key={message.id}
        >
          {!own && <Avatar message={message} />}
          <div className="msg__bubble msg__bubble--deleted">
            <p className="msg__deleted">
              <IconBan aria-hidden="true" />
              <span>
                {!own && (
                  <span
                    className="msg__deleted-author"
                    style={{ color: authorColor(message.authorId) }}
                  >
                    {shortName(message.author)}:{' '}
                  </span>
                )}
                {deletedText(message.deleted, own)}
              </span>
              <Stamp message={message} />
            </p>
          </div>
        </div>
      );
    }

    // У чужой реплики есть шапка — кнопка встаёт в её конец, как в мессенджерах.
    // У своей шапки нет, и кнопка висит в углу пузыря
    const more = (
      /* Полоса раскрывается по ширине и отодвигает соседа —
         в покое кнопка не занимает места (тот же приём, что у «Отмены») */
      <span className="reveal-x msg__more-slot">
        <span className="reveal-x__clip">
          <button
            className="msg__more"
            type="button"
            aria-label="Действия с сообщением"
            aria-expanded={openMenu === message.id}
            onClick={(event) => {
              event.stopPropagation(); // иначе тот же клик сразу закроет меню

              // Меряем в момент открытия: сколько ленты осталось под тем, из-под чего
              // падает меню. У чужой реплики это сам пузырь (кнопка сидит в его шапке),
              // у своей — кнопка снаружи
              const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
              const anchor = event.currentTarget.closest('.msg__bubble') ?? event.currentTarget;
              const below =
                listRef.current.getBoundingClientRect().bottom -
                anchor.getBoundingClientRect().bottom;
              setMenuUp(below < MENU_ROOM_REM * rem);

              setOpenMenu((current) => (current === message.id ? null : message.id));
            }}
          >
            <IconChevronDown aria-hidden="true" />
          </button>
        </span>
      </span>
    );

    // Меню растёт из своей кнопки (§4.3): у чужой реплики кнопка в шапке пузыря,
    // у своей — снаружи, слева от него; меню встаёт туда же, где кнопка
    const mine = message.reactions?.find((item) => item.mine)?.emoji;
    const menu = openMenu === message.id && (
      <div
        className={`row-menu row-menu--msg${menuUp ? ' row-menu--above' : ''}`}
        role="menu"
      >
        {/* Реакции — первым рядом: самое частое, что делают с чужой репликой.
            «+» в конце открывает все эмодзи */}
        <div className="row-menu__reactions">
          {REACTIONS.map((emoji) => {
            const chosen = message.reactions?.some((item) => item.mine && item.emoji === emoji);
            return (
              <button
                key={emoji}
                className={`row-menu__reaction${chosen ? ' row-menu__reaction--chosen' : ''}`}
                type="button"
                role="menuitem"
                aria-label={chosen ? `Убрать реакцию ${emoji}` : `Реакция ${emoji}`}
                aria-pressed={chosen}
                onClick={(event) => {
                  event.stopPropagation();
                  react(message, emoji);
                }}
              >
                {emoji}
              </button>
            );
          })}

          <button
            className={`row-menu__reaction row-menu__reaction--more${
              mine && !REACTIONS.includes(mine) ? ' row-menu__reaction--chosen' : ''
            }`}
            type="button"
            role="menuitem"
            aria-label="Все реакции"
            onClick={(event) => {
              event.stopPropagation();
              setPicker({ id: message.id, anchor: event.currentTarget.getBoundingClientRect() });
              setOpenMenu(null);
            }}
          >
            <IconPlus aria-hidden="true" />
          </button>
        </div>

        {message.text && (
          <button
            className="row-menu__item"
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              copy(message);
            }}
          >
            <IconCopy aria-hidden="true" />
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        )}

        {message.file && (
          /* У видео и документа — «Скачать», как было в системном «⋮» плеера */
          <a
            className="row-menu__item"
            role="menuitem"
            href={message.file.url}
            download={message.file.name}
            onClick={() => setOpenMenu(null)}
          >
            <IconDownload aria-hidden="true" />
            Скачать
          </a>
        )}

        <button
          className="row-menu__item"
          type="button"
          role="menuitem"
          onClick={() => {
            setReplying(message);
            setOpenMenu(null);
            inputRef.current?.focus();
          }}
        >
          <IconReply aria-hidden="true" />
          Ответить
        </button>

        {canModerate && (
          <button
            className="row-menu__item"
            type="button"
            role="menuitem"
            onClick={() => pin(message.id, !pinned.some((item) => item.id === message.id))}
          >
            {pinned.some((item) => item.id === message.id) ? (
              <>
                <IconPin aria-hidden="true" />
                Открепить
              </>
            ) : (
              <>
                <IconPin aria-hidden="true" />
                Закрепить
              </>
            )}
          </button>
        )}

        {(own || canModerate) && (
          <button
            className="row-menu__item row-menu__item--danger"
            type="button"
            role="menuitem"
            onClick={() => removeMessage(message)}
          >
            <IconTrash aria-hidden="true" />
            Удалить
          </button>
        )}
      </div>
    );

    const reactions = message.reactions ?? [];

    return (
      <div
        className={`msg${own ? ' msg--own' : ''}${reactions.length ? ' msg--reacted' : ''}`}
        id={`msg-${message.id}`}
        key={message.id}
      >
        {!own && (
          // У голосового аватар уже внутри пузыря (с микрофоном) — внешний не дублируем,
          // но место держим: иначе пузырь выпал бы из общего ряда
          <Avatar message={message} voice={message.file?.kind === 'voice'} />
        )}

        <div
          className={`msg__bubble${
            message.photo || message.file?.kind === 'video' || message.file?.kind === 'image'
              ? ' msg__bubble--photo'
              : ''
          }${
            message.file?.kind === 'document' ||
            message.file?.kind === 'audio' ||
            message.file?.kind === 'voice'
              ? ' msg__bubble--file'
              : ''
          }`}
        >
          {!own && menu}

          {!own && (
            /* Ник называет человека, номер рядом — по нему его находят */
            <span className="msg__head">
              <span
                className="msg__author"
                style={{ color: authorColor(message.authorId) }}
              >
                {message.username ? `@${message.username}` : shortName(message.author)}
              </span>

              {message.phone && (
                <span className="msg__phone">{formatPhone(message.phone)}</span>
              )}

              {more}
            </span>
          )}

          {/* Время плывёт вправо и садится в конец последней строки —
              короткая реплика не занимает из-за него вторую */}
          {message.replyTo && (
            /* Цитата ведёт к оригиналу: разговор не теряет нить */
            <button
              className="msg__quote"
              type="button"
              /* Цвет ставится на всю цитату: полоса слева берёт его из currentColor */
              style={{ color: own ? undefined : authorColor(message.replyTo.authorId) }}
              onClick={() =>
                document
                  .getElementById(`msg-${message.replyTo.id}`)
                  ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              }
            >
              <span className="msg__quote-author">
                {message.replyTo.username
                  ? `@${message.replyTo.username}`
                  : shortName(message.replyTo.author)}
              </span>
              <span className="msg__quote-text">{messageLabel(message.replyTo)}</span>
            </button>
          )}

          {message.photo && (
            /* Место под снимок известно заранее — лента не прыгает, пока он грузится.
               Целиком он открывается тут же, в окне поверх страницы */
            <button
              className="msg__photo"
              type="button"
              aria-label="Открыть фото"
              style={{ aspectRatio: `${message.photo.width} / ${message.photo.height}` }}
              onClick={() => setViewing(message.photo)}
            >
              <img src={message.photo.url} alt="" loading="lazy" />

              {/* Без подписи времени негде сесть — оно ложится на сам снимок */}
              {!message.text && (
                <Stamp
                  message={message}
                  own={own}
                  readByAll={readByAll}
                  className="msg__photo-time"
                />
              )}
            </button>
          )}

          {message.file?.kind === 'video' && (
            <ChatVideo
              file={message.file}
              onOpen={setViewing}
              time={
                // Внизу у видео свои кнопки — время садится в верхний угол
                !message.text && (
                  <Stamp
                    message={message}
                    own={own}
                    readByAll={readByAll}
                    className="msg__photo-time"
                  />
                )
              }
            />
          )}

          {message.file?.kind === 'image' && (
            <ChatImage
              file={message.file}
              onOpen={setViewing}
              time={
                !message.text && (
                  <Stamp
                    message={message}
                    own={own}
                    readByAll={readByAll}
                    className="msg__photo-time"
                  />
                )
              }
            />
          )}

          {(message.file?.kind === 'audio' || message.file?.kind === 'voice') && (
            <ChatAudio
              file={message.file}
              // Чей голос: у своего — свой снимок профиля, у чужого — буква его цвета
              author={{
                id: message.authorId,
                name: message.author,
                photo: message.authorPhoto,
              }}
              fallback={<Unplayable file={message.file} what="Аудио" />}
              time={
                !message.text && (
                  <Stamp
                    message={message}
                    own={own}
                    readByAll={readByAll}
                    className="msg__file-time"
                  />
                )
              }
            />
          )}

          {message.file?.kind === 'document' && (
            /* Документ — карточкой: что это, сколько весит; нажатие скачивает */
            <a className="msg__file" href={message.file.url} download={message.file.name}>
              <span className="msg__file-icon" aria-hidden="true">
                <IconDocument />
              </span>
              <span className="msg__file-body">
                <span className="msg__file-name">{message.file.name}</span>
                <span className="msg__file-meta">
                  {extensionOf(message.file.name).toUpperCase()} ·{' '}
                  {formatSize(message.file.size)}
                  {!message.text && (
                    <Stamp
                      message={message}
                      own={own}
                      readByAll={readByAll}
                      className="msg__file-time"
                    />
                  )}
                </span>
              </span>
            </a>
          )}

          {message.text && (
            <p className="msg__text">
              {withMark(
                withRich(message.text, mentionClass),
                mark?.id === message.id ? mark.query : null,
              )}
              <Stamp message={message} own={own} readByAll={readByAll} />
            </p>
          )}

          {reactions.length > 0 && (
            /* Капсулы садятся на нижний край пузыря, как в мессенджерах. Нажатие
               ставит или снимает ту же реакцию; кто поставил — в подсказке */
            <div className="msg__reactions">
              {reactions.map((item) => (
                <button
                  key={item.emoji}
                  className={`msg__reaction${item.mine ? ' msg__reaction--mine' : ''}`}
                  type="button"
                  title={item.names.join(', ')}
                  aria-label={`${item.emoji} ${item.count}: ${item.names.join(', ')}`}
                  aria-pressed={item.mine}
                  onClick={() => react(message, item.emoji)}
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  {item.count > 1 && <span className="msg__reaction-count">{item.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* У своей реплики шапки нет, а внутри пузыря кнопке мешает время —
            поэтому она встаёт рядом, со свободной стороны, и меню вместе с ней */}
        {own && (
          <span className="msg__more-box">
            {more}
            {menu}
          </span>
        )}
      </div>
    );
  }

  // Полоска показывает одно закрепление за раз. Список мог укоротиться, пока
  // смотрели, — номер придерживаем в границах
  const pinShown = pinned.length ? Math.min(pinAt, pinned.length - 1) : 0;
  const pinCurrent = pinned[pinShown] ?? null;

  return (
    // Обёртка несёт обои: они тянутся и под лентой, и под полем ввода
    <div className="chat" {...dropZone}>
      {/* Тащат файл — весь чат становится зоной: отпустить можно куда угодно */}
      <div className={`chat__drop${dragging ? ' chat__drop--shown' : ''}`} aria-hidden="true">
        <span className="chat__drop-card">
          <IconUpload />
          <span className="chat__drop-title">Отпустите, чтобы прикрепить</span>
          <span className="chat__drop-hint">Фото, видео, аудио или документ</span>
        </span>
      </div>

      {nav && (
        /* Панель закрылась, но поиск не кончился: полоска помнит, что искали,
           и шагает по находкам, не открывая список заново. Список идёт от новых
           к старым, поэтому «вверх» — это к более раннему */
        <div className="chat__nav">
          <span className="chat__nav-query">
            <IconSearch aria-hidden="true" />
            {nav.query}
          </span>

          <span className="chat__nav-count">
            {nav.at + 1} из {nav.list.length}
          </span>

          <button
            className="chat__nav-button"
            type="button"
            aria-label="Находка выше"
            disabled={jumping || nav.at >= nav.list.length - 1}
            onClick={() => goFound(nav.list, nav.at + 1, nav.query)}
          >
            <IconChevronUp aria-hidden="true" />
          </button>

          <button
            className="chat__nav-button"
            type="button"
            aria-label="Находка ниже"
            disabled={jumping || nav.at <= 0}
            onClick={() => goFound(nav.list, nav.at - 1, nav.query)}
          >
            <IconChevronDown aria-hidden="true" />
          </button>

          <button
            className="chat__nav-button"
            type="button"
            aria-label="Закончить поиск"
            onClick={() => {
              setNav(null);
              setMark(null);
            }}
          >
            <IconClose aria-hidden="true" />
          </button>
        </div>
      )}

      {pinCurrent && (
        /* Объявление держится над лентой: его читают, не листая переписку.
           Закреплений может быть несколько — полоска показывает по одному и
           после перехода переключается на следующее, как в Telegram */
        <div className="chat__pin">
          <button
            className="chat__pin-go"
            type="button"
            onClick={() => {
              jumpTo(pinCurrent.id);
              if (pinned.length > 1) setPinAt((at) => (at + 1) % pinned.length);
            }}
          >
            <IconPinSolid className="chat__pin-icon" aria-hidden="true" />
            <span className="chat__pin-body">
              <span className="chat__pin-title">Закреплённое сообщение</span>
              <span className="chat__pin-text">{messageLabel(pinCurrent)}</span>
            </span>
          </button>

          {pinned.length > 1 && (
            <span className="chat__pin-count">
              {pinShown + 1} из {pinned.length}
            </span>
          )}

          {canModerate && (
            <button
              className="chat__pin-off"
              type="button"
              aria-label="Открепить"
              onClick={() => pin(pinCurrent.id, false)}
            >
              <IconClose aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Лента с кнопкой ↓ поверх: кнопка держится у нижнего края ленты */}
      <div className="chat__feed">
      <div className="chat__list" ref={listRef} onScroll={trackBottom}>
        {/* Сверху — либо подгрузка истории, либо честное «дальше ничего нет» */}
        {!loading && messages.length > 0 && (
          <p className="chat__history">
            {loadingOlder ? 'Загружаем историю…' : hasMore ? '' : 'Начало переписки'}
          </p>
        )}

        {loading ? (
          <p className="chat__empty">Загружаем…</p>
        ) : messages.length === 0 ? (
          <p className="chat__empty">Здесь пока пусто. Напишите первым.</p>
        ) : (
          days.map((day) => (
            /* День — своя секция: липкая дата держится, пока листают её день,
               а следующая выталкивает её, а не ложится сверху */
            <section className="chat__day-group" key={day.key}>
              <time className="chat__day" dateTime={day.at}>
                {dayLabel(day.at)}
              </time>

              {day.messages.map((message) => (
                <Fragment key={message.id}>
                  {/* Черта «Новые сообщения» — перед первым непрочитанным: с неё
                      и продолжают читать. Стоит, пока открыт этот чат */}
                  {message.id === firstUnreadId && (
                    <div className="chat__unread-line" ref={unreadLineRef}>
                      <span>Новые сообщения</span>
                    </div>
                  )}
                  {renderMessage(message)}
                </Fragment>
              ))}
            </section>
          ))
        )}
      </div>

        {/* ↓ — только когда ушли читать выше. Число — сколько пришло за это время */}
        <button
          className={`chat__down${showDown ? ' chat__down--shown' : ''}`}
          type="button"
          aria-label={newBelow ? `К новым сообщениям: ${newBelow}` : 'К последним сообщениям'}
          tabIndex={showDown ? undefined : -1}
          onClick={toBottom}
        >
          <IconArrowDown aria-hidden="true" />
          {newBelow > 0 && <span className="chat__down-badge">{newBelow}</span>}
        </button>
      </div>

      {error && (
        <p className="chat__error" role="alert">
          {error}
        </p>
      )}

      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />

      {picker && (
        <EmojiPicker
          anchor={picker.anchor}
          chosen={
            messages.find((item) => item.id === picker.id)?.reactions?.find((item) => item.mine)?.emoji
          }
          onPick={(emoji) => {
            // Сообщение берём свежее: пока окно открыто, опрос мог принести чужие реакции
            const message = messages.find((item) => item.id === picker.id);
            if (message) react(message, emoji);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {typing.length > 0 && (
        /* Над полем ввода, а не в шапке: смотрят сюда — сюда и ответят */
        <p className="chat__typing">
          {typing.map((item) => shortName(item.name)).join(', ')}{' '}
          {typing.length > 1 ? 'печатают' : 'печатает'}
          <span className="chat__typing-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
      )}

      {/* Ответ и поле ввода — одна карточка: отвечают тут же, где набирают */}
      <div className={`chat__box${tall ? ' chat__box--tall' : ''}`}>
        <div className={`reveal-y${replying ? ' reveal-y--open' : ''}`}>
        <div className="reveal-y__clip">
            <div className="chat__reply">
              <span className="chat__reply-body">
                <span className="chat__reply-author">
                  {replying?.username ? `@${replying.username}` : shortName(replying?.author ?? '')}
                </span>
                <span className="chat__reply-text">
                  {replying && messageLabel(replying)}
                </span>
              </span>

              <button
                className="chat__reply-close"
                type="button"
                aria-label="Отменить ответ"
                tabIndex={replying ? undefined : -1}
                onClick={() => setReplying(null)}
              >
                <IconClose aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Снимок ждёт отправки там же, где пишут подпись к нему */}
        <div className={`reveal-y${photo ? ' reveal-y--open' : ''}`}>
          <div className="reveal-y__clip">
            <div className="chat__photo">
              {shownPhoto.current && (
                <img className="chat__photo-preview" src={shownPhoto.current.dataUrl} alt="" />
              )}
              <span className="chat__photo-label">Фото</span>

              <button
                className="chat__reply-close"
                type="button"
                aria-label="Убрать фото"
                tabIndex={photo ? undefined : -1}
                onClick={() => setPhoto(null)}
              >
                <IconClose aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Видео или документ ждут так же. Пока файл уходит, под ним полоса хода */}
        <div className={`reveal-y${attachment ? ' reveal-y--open' : ''}`}>
          <div className="reveal-y__clip">
            {shownAttachment.current && (
              <div className="chat__photo">
                {shownAttachment.current.kind === 'video' ? (
                  <video
                    className="chat__photo-preview"
                    src={`${shownAttachment.current.preview}#t=0.1`}
                    muted
                    preload="metadata"
                  />
                ) : (
                  <span className="chat__photo-preview chat__file-icon" aria-hidden="true">
                    {shownAttachment.current.kind === 'image' ? (
                      <IconImage />
                    ) : shownAttachment.current.kind === 'audio' ? (
                      <IconMusic />
                    ) : (
                      <IconDocument />
                    )}
                  </span>
                )}

                <span className="chat__file-body">
                  <span className="chat__file-name">
                    {{ video: 'Видео', image: 'Фото' }[shownAttachment.current.kind] ??
                      shownAttachment.current.name}
                  </span>
                  <span className="chat__photo-label">
                    {shownAttachment.current.kind === 'image'
                      ? `${extensionOf(shownAttachment.current.name).toUpperCase()} · `
                      : ''}
                    {shownAttachment.current.duration
                      ? `${formatDuration(shownAttachment.current.duration)} · `
                      : ''}
                    {progress === null
                      ? formatSize(shownAttachment.current.size)
                      : `Загружаем… ${Math.round(progress * 100)}%`}
                  </span>
                  {progress !== null && (
                    <span className="chat__progress" aria-hidden="true">
                      <span style={{ transform: `scaleX(${progress})` }} />
                    </span>
                  )}
                </span>

                <button
                  className="chat__reply-close"
                  type="button"
                  /* Тот же крестик: пока файл идёт — обрывает отправку, иначе
                     просто снимает вложение. Гаснет только на последнем шаге,
                     когда файл уже на сервере и уходит само сообщение */
                  aria-label={progress === null ? 'Убрать вложение' : 'Отменить отправку'}
                  tabIndex={attachment ? undefined : -1}
                  disabled={sending && progress === null}
                  onClick={() => (progress === null ? setAttachment(null) : upload.current?.abort())}
                >
                  <IconClose aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        <form className="chat__composer" onSubmit={send}>
          {/* Системный выбор файла: своё окно выбора платформа уже умеет */}
          <input
            ref={fileRef}
            type="file"
            accept={MEDIA_ACCEPT}
            hidden
            onChange={fromInput(pickMedia)}
          />
          <input
            ref={documentRef}
            type="file"
            accept={DOCUMENT_ACCEPT}
            hidden
            onChange={fromInput(pickDocument)}
          />
          <input
            ref={audioRef}
            type="file"
            accept={AUDIO_ACCEPT}
            hidden
            onChange={fromInput(pickAudio)}
          />

          {/* Идёт запись: вместо вложений — «выбросить», вместо поля — время и уровень */}
          {recorder.recording ? (
            <>
              <button
                className="chat__attach chat__rec-cancel"
                type="button"
                aria-label="Отменить запись"
                disabled={sending}
                onClick={recorder.cancel}
              >
                <IconTrash aria-hidden="true" />
              </button>

              <div className="chat__recording" role="status" aria-live="off">
                <span className="chat__rec-dot" aria-hidden="true" />
                <span className="chat__rec-time">{formatDuration(recorder.elapsed)}</span>
                {/* Живые столбики: громкость последних секунд, новое — справа */}
                <span className="chat__rec-bars" aria-hidden="true">
                  {recorder.levels.map((level, index) => (
                    // Корень — та же шкала, что у волны в ленте: тихое не пропадает
                    <span key={index} style={{ '--h': Math.min(1, Math.sqrt(level) * 1.6) }} />
                  ))}
                </span>
                <span className="chat__rec-hint">{sending ? 'Отправляем…' : 'Esc — отмена'}</span>
              </div>
            </>
          ) : (
            <>
          {/* Меню вложений: фото и видео, документы, аудио */}
          <div className="chat__attach-box">
            <button
              className="chat__attach"
              type="button"
              aria-label="Добавить вложение"
              aria-expanded={attaching}
              onClick={(event) => {
                event.stopPropagation(); // иначе тот же клик сразу закроет меню
                setAttaching((was) => !was);
              }}
            >
              <IconPlus aria-hidden="true" />
            </button>

            {attaching && (
              <div className="row-menu row-menu--up" role="menu">
                <button
                  className="row-menu__item"
                  type="button"
                  role="menuitem"
                  onClick={() => documentRef.current?.click()}
                >
                  <IconDocument aria-hidden="true" />
                  Документ
                </button>
                <button
                  className="row-menu__item"
                  type="button"
                  role="menuitem"
                  onClick={() => fileRef.current?.click()}
                >
                  <IconImages aria-hidden="true" />
                  Фото и видео
                </button>
                <button
                  className="row-menu__item"
                  type="button"
                  role="menuitem"
                  onClick={() => audioRef.current?.click()}
                >
                  <IconMusic aria-hidden="true" />
                  Аудио
                </button>
              </div>
            )}
          </div>

          <label className="visually-hidden" htmlFor="chat-input">
            Сообщение
          </label>
          {picking && (
            /* Список растёт вверх из поля — туда же, где потом окажется ник.
               mousedown гасим: иначе поле теряет фокус раньше, чем дойдёт клик */
            <div
              className="chat__mentions"
              role="listbox"
              aria-label="Кого упомянуть"
              onMouseDown={(event) => event.preventDefault()}
            >
              {suggestions.map((member, index) => (
                <button
                  key={member.id}
                  className={`chat__mention${index === at ? ' chat__mention--active' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={index === at}
                  onMouseEnter={() => setMentionAt(index)}
                  onClick={() => pickMention(member)}
                >
                  <span
                    className="chat__mention-avatar"
                    style={{ '--author': authorColor(member.id) }}
                    aria-hidden="true"
                  >
                    {member.photo ? (
                      <img src={member.photo} alt="" />
                    ) : (
                      initial(member.name)
                    )}
                  </span>
                  <span className="chat__mention-name">{shortName(member.name)}</span>
                  <span className="chat__mention-nick">@{member.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* textarea, а не input: абзацы в сообщении — нормальное дело */}
          <textarea
            id="chat-input"
            ref={inputRef}
            className="chat__input"
            rows={1}
            placeholder={photo || attachment ? 'Подпись' : 'Сообщение'}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              watchMention(event.target);
              if (event.target.value.trim()) tellTyping();
            }}
            // Курсор переставили мышью или стрелками — набор ника мог начаться
            // или кончиться, а onChange об этом не говорит
            onSelect={(event) => watchMention(event.target)}
            onBlur={() => setMention(null)}
            onKeyDown={sendOnEnter}
          />
            </>
          )}

          {/* Одна кнопка на месте «отправить»: есть что отправить — стрелка; пусто —
              микрофон; идёт запись — стрелка, которая отправляет голосовое.
              Значок меняется с коротким масштабом (ключ), а не перескоком */}
          {recorder.recording ? (
            <button
              className="chat__send"
              type="button"
              aria-label="Отправить голосовое"
              disabled={sending}
              onClick={sendVoice}
            >
              <IconArrowUp aria-hidden="true" key="send-voice" />
            </button>
          ) : hasContent || !canRecord ? (
            <button
              className="chat__send"
              type="submit"
              disabled={!hasContent || sending}
              aria-label="Отправить"
            >
              <IconArrowUp aria-hidden="true" key="send" />
            </button>
          ) : (
            <button
              className="chat__send chat__send--mic"
              type="button"
              aria-label="Записать голосовое"
              disabled={sending}
              onClick={startVoice}
            >
              <IconMic aria-hidden="true" key="mic" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
