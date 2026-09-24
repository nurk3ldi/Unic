import { useEffect, useRef, useState } from 'react';
import {
  IoAdd,
  IoArrowUp,
  IoChevronDown,
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

  const [messages, setMessages] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // id сообщения
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

  // Лента живёт концом: новое сообщение подводит её к себе
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  async function send(event) {
    event.preventDefault();

    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const { message } = await api.sendClubMessage(clubId, { text: body });
      // Своё сообщение показываем сразу, не дожидаясь следующего опроса
      setMessages((was) => [...was, message]);
      setText('');
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

            return (
              <div className={`msg${own ? ' msg--own' : ''}`} key={message.id}>
                {!own && (
                  <span className="msg__avatar" aria-hidden="true">
                    {initial(message.author)}
                  </span>
                )}

                <div className="msg__bubble">
                  {/* Появляется по наведению: в спокойном состоянии лента чистая */}
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

                  {openMenu === message.id && (
                    <div className="row-menu row-menu--msg" role="menu">
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
                    </span>
                  )}

                  {/* Время плывёт вправо и садится в конец последней строки —
                      короткая реплика не занимает из-за него вторую */}
                  <p className="msg__text">
                    {message.text}
                    <time className="msg__time" dateTime={message.createdAt}>
                      {messageTime.format(new Date(message.createdAt))}
                    </time>
                  </p>
                </div>
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

      <form className="chat__composer" onSubmit={send}>
        {/* Меню вложений: пока только вид — сами вложения появятся позже */}
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
              <button className="row-menu__item" type="button" role="menuitem">
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
          placeholder="Сообщение"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <button
          className="chat__send"
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Отправить"
        >
          <IoArrowUp aria-hidden="true" />
        </button>
      </form>
    </>
  );
}
