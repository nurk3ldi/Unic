import { useEffect, useRef, useState } from 'react';
import {
  IoAdd,
  IoArrowUp,
  IoArrowUndoOutline,
  IoChevronDown,
  IoClose,
  IoCopyOutline,
  IoDocumentTextOutline,
  IoImagesOutline,
  IoMusicalNotesOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { POLL_MS, messageTime } from '../chat.js';
import { authorColor, formatPhone, initial, shortName } from '../people.js';
import { chatPhoto } from '../photo.js';
import './ChatRoom.css';

// Чужое сообщение убирают те же роли, что управляют клубом
const MANAGE_ROLES = ['university', 'admin'];

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
export default function ChatRoom({ clubId }) {
  const { user } = useAuth();

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  // Превью держит последний снимок, пока полоса сворачивается, — иначе
  // картинка исчезла бы раньше, чем закрылось место под неё
  const shownPhoto = useRef(null);

  const [messages, setMessages] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // id сообщения
  const [replying, setReplying] = useState(null); // сообщение, на которое отвечаем
  const [photo, setPhoto] = useState(null); // { dataUrl, width, height } — снимок к отправке
  const [viewing, setViewing] = useState(null); // снимок, открытый на весь экран
  const viewerRef = useRef(null);
  // Окно держит последний снимок, пока растворяется, — иначе он пропал бы раньше окна
  const shownView = useRef(null);
  if (viewing) shownView.current = viewing;
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    async function load() {
      if (document.hidden) return;
      try {
        const { messages } = await api.clubMessages(clubId);
        if (alive) {
          setMessages(messages);
          setError('');
        }
      } catch (failure) {
        if (alive) setError(failure.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [clubId]);

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

  async function removeMessage(message) {
    setOpenMenu(null);
    try {
      await api.deleteClubMessage(clubId, message.id);
      setMessages((was) => was.filter((item) => item.id !== message.id));
    } catch (failure) {
      setError(failure.message);
    }
  }

  // Окно просмотра — нативный <dialog>: Esc, фокус и верхний слой даёт платформа
  useEffect(() => {
    const dialog = viewerRef.current;
    if (!dialog) return;

    if (viewing && !dialog.open) dialog.showModal();
    if (!viewing && dialog.open) dialog.close();
  }, [viewing]);

  // Лента живёт концом: новое сообщение подводит её к себе
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  if (photo) shownPhoto.current = photo;

  /** Снимок сжимается в браузере и ждёт в поле ввода: к нему можно дописать подпись. */
  async function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // тот же файл можно выбрать снова
    if (!file) return;

    try {
      setPhoto(await chatPhoto(file));
      setError('');
      inputRef.current?.focus();
    } catch {
      setError('Не удалось прочитать фото. Выберите JPEG или PNG.');
    }
  }

  async function send(event) {
    event.preventDefault();

    const body = text.trim();
    if ((!body && !photo) || sending) return;

    setSending(true);
    try {
      const { message } = await api.sendClubMessage(clubId, {
        text: body,
        replyTo: replying?.id ?? null,
        photo: photo?.dataUrl ?? null,
        photoWidth: photo?.width ?? null,
        photoHeight: photo?.height ?? null,
      });
      // Своё сообщение показываем сразу, не дожидаясь следующего опроса
      setMessages((was) => [...was, message]);
      setText('');
      setReplying(null);
      setPhoto(null);
      setError('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <div className="chat__list" ref={listRef}>
        {loading ? (
          <p className="chat__empty">Загружаем…</p>
        ) : messages.length === 0 ? (
          <p className="chat__empty">Здесь пока пусто. Напишите первым.</p>
        ) : (
          messages.map((message) => {
            const own = message.authorId === user?.id;

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
                      setOpenMenu((current) => (current === message.id ? null : message.id));
                    }}
                  >
                    <IoChevronDown aria-hidden="true" />
                  </button>
                </span>
              </span>
            );

            return (
              <div
                className={`msg${own ? ' msg--own' : ''}`}
                id={`msg-${message.id}`}
                key={message.id}
              >
                {!own && (
                  <span className="msg__avatar" aria-hidden="true">
                    {initial(message.author)}
                  </span>
                )}

                <div className={`msg__bubble${message.photo ? ' msg__bubble--photo' : ''}`}>
                  {openMenu === message.id && (
                    <div className="row-menu row-menu--msg" role="menu">
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
                          <IoCopyOutline aria-hidden="true" />
                          {copied ? 'Скопировано' : 'Копировать'}
                        </button>
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
                        <IoArrowUndoOutline aria-hidden="true" />
                        Ответить
                      </button>

                      {(own || MANAGE_ROLES.includes(user?.role)) && (
                        <button
                          className="row-menu__item row-menu__item--danger"
                          type="button"
                          role="menuitem"
                          onClick={() => removeMessage(message)}
                        >
                          <IoTrashOutline aria-hidden="true" />
                          Удалить
                        </button>
                      )}
                    </div>
                  )}

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
                      <span className="msg__quote-text">
                        {message.replyTo.text || 'Фото'}
                      </span>
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
                        <time className="msg__photo-time" dateTime={message.createdAt}>
                          {messageTime.format(new Date(message.createdAt))}
                        </time>
                      )}
                    </button>
                  )}

                  {message.text && (
                    <p className="msg__text">
                      {message.text}
                      <time className="msg__time" dateTime={message.createdAt}>
                        {messageTime.format(new Date(message.createdAt))}
                      </time>
                    </p>
                  )}
                </div>

                {/* У своей реплики шапки нет, а внутри пузыря кнопке мешает время —
                    поэтому она встаёт рядом, со свободной стороны */}
                {own && more}
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p className="chat__error" role="alert">
          {error}
        </p>
      )}

      {/* Просмотр снимка. Клик мимо фото — тоже выход: так закрывают любое окно */}
      <dialog
        className="photo-viewer"
        ref={viewerRef}
        aria-label="Просмотр фото"
        onClose={() => setViewing(null)}
        onClick={(event) => event.target === event.currentTarget && setViewing(null)}
      >
        {shownView.current && (
          <img className="photo-viewer__image" src={shownView.current.url} alt="" />
        )}

        <button
          className="photo-viewer__close"
          type="button"
          aria-label="Закрыть"
          onClick={() => setViewing(null)}
        >
          <IoClose aria-hidden="true" />
        </button>
      </dialog>

      {/* Ответ и поле ввода — одна карточка: отвечают тут же, где набирают */}
      <div className="chat__box">
        <div className={`reveal-y${replying ? ' reveal-y--open' : ''}`}>
        <div className="reveal-y__clip">
            <div className="chat__reply">
              <span className="chat__reply-body">
                <span className="chat__reply-author">
                  {replying?.username ? `@${replying.username}` : shortName(replying?.author ?? '')}
                </span>
                <span className="chat__reply-text">
                  {replying && (replying.text || 'Фото')}
                </span>
              </span>

              <button
                className="chat__reply-close"
                type="button"
                aria-label="Отменить ответ"
                tabIndex={replying ? undefined : -1}
                onClick={() => setReplying(null)}
              >
                <IoClose aria-hidden="true" />
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
                <IoClose aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <form className="chat__composer" onSubmit={send}>
          {/* Системный выбор файла: своё окно выбора платформа уже умеет */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={pickPhoto}
          />

          {/* Меню вложений: пока работает «Фото», документы и аудио — позже */}
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
              <IoAdd aria-hidden="true" />
            </button>

            {attaching && (
              <div className="row-menu row-menu--up" role="menu">
                <button className="row-menu__item" type="button" role="menuitem">
                  <IoDocumentTextOutline aria-hidden="true" />
                  Документ
                </button>
                <button
                  className="row-menu__item"
                  type="button"
                  role="menuitem"
                  onClick={() => fileRef.current?.click()}
                >
                  <IoImagesOutline aria-hidden="true" />
                  Фото и видео
                </button>
                <button className="row-menu__item" type="button" role="menuitem">
                  <IoMusicalNotesOutline aria-hidden="true" />
                  Аудио
                </button>
              </div>
            )}
          </div>

          <label className="visually-hidden" htmlFor="chat-input">
            Сообщение
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            className="chat__input"
            placeholder={photo ? 'Подпись' : 'Сообщение'}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <button
            className="chat__send"
            type="submit"
            disabled={(!text.trim() && !photo) || sending}
            aria-label="Отправить"
          >
            <IoArrowUp aria-hidden="true" />
          </button>
        </form>
      </div>
    </>
  );
}
