import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowUp, IconChevronRight } from '../icons.jsx';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { POLL_MS, messageLabel } from '../chat.js';
import { membersLabel } from '../club.js';
import { authorColor, initial, shortName } from '../people.js';
import './ClubChatCard.css';

// Сколько последних реплик держим: в квадрат карточки больше не помещается,
// а лишние всё равно скрылись бы под верхним краем
const SHOWN = 12;
// Сколько лиц в шапке; остальные — числом «+N»
const FACES = 4;
// Пока реплик меньше, пустое место объясняет, что это за чат, и зовёт написать
const QUIET = 3;

/**
 * Свёрнутый чат клуба: сверху — кто здесь (лица участников), посередине — живая
 * переписка в миниатюре (свои справа синим, чужие слева с именем), снизу — поле,
 * чтобы ответить, не уходя со страницы клуба. Шапка и лента ведут в сам чат.
 */
export default function ClubChatCard({ clubId, members = [] }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      if (document.hidden) return;
      try {
        const { messages } = await api.clubMessages(clubId);
        if (alive) {
          setMessages(messages.slice(-SHOWN));
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

  async function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const { message } = await api.sendClubMessage(clubId, { text: body });
      // Своё сообщение — сразу, не дожидаясь следующего опроса
      setMessages((was) => [...was, message].slice(-SHOWN));
      setText('');
      setSendError('');
    } catch (failure) {
      // Набранное остаётся: неудавшуюся отправку всё ещё хотят отправить
      setSendError(failure.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="chat-card__empty">Загружаем…</p>;
  // Чужому клубу чат закрыт — карточка говорит об этом, а не показывает поле в никуда
  if (error) return <p className="chat-card__empty">{error}</p>;

  const faces = members.slice(0, FACES);
  const more = members.length - faces.length;

  return (
    <div className="chat-card">
      {/* Шапка как у виджета: что это, кто здесь, и шеврон — сюда можно войти */}
      <Link className="chat-card__head" to={`/chats/${clubId}`} viewTransition>
        <span className="chat-card__title">
          Чат клуба
          <span className="chat-card__count">{membersLabel(members.length)}</span>
        </span>

        {faces.length > 0 && (
          <span className="chat-card__faces" aria-hidden="true">
            {faces.map((person) => (
              <span
                className="chat-card__face"
                key={person.id}
                style={{ color: authorColor(person.id) }}
              >
                {person.photo ? <img src={person.photo} alt="" /> : initial(person.name)}
              </span>
            ))}
            {more > 0 && <span className="chat-card__face chat-card__face--more">+{more}</span>}
          </span>
        )}

        <IconChevronRight className="chat-card__chevron" aria-hidden="true" />
      </Link>

      {/* Лента прижата к низу, как в чате: новое — последней строкой, старое
          уходит вверх и растворяется под краем. Вся лента — тоже вход в чат */}
      <Link className="chat-card__feed" to={`/chats/${clubId}`} viewTransition>
        {messages.length < QUIET && (
          <span className="chat-card__invite">
            <span className="chat-card__invite-title">
              {messages.length === 0 ? 'Здесь начинается чат клуба' : 'Чат только начался'}
            </span>
            Напишите — участники увидят сразу
          </span>
        )}

        {messages.map((message) => {
          const own = message.authorId === user?.id;
          return (
            <span
              className={`chat-card__msg${own ? ' chat-card__msg--own' : ''}`}
              key={message.id}
            >
              {!own && (
                <span
                  className="chat-card__author"
                  style={{ color: authorColor(message.authorId) }}
                >
                  {shortName(message.author)}
                </span>
              )}
              <span className="chat-card__text">{messageLabel(message)}</span>
            </span>
          );
        })}
      </Link>

      {/* Быстрый ответ: только текст — фото, файлы и голос остаются в самом чате */}
      <form className="chat-card__compose" onSubmit={send}>
        <label className="visually-hidden" htmlFor={`chat-card-${clubId}`}>
          Сообщение в чат клуба
        </label>
        <input
          id={`chat-card-${clubId}`}
          className="chat-card__input"
          value={text}
          placeholder="Написать в чат…"
          maxLength={2000}
          autoComplete="off"
          onChange={(event) => {
            setText(event.target.value);
            setSendError('');
          }}
        />
        <button
          className="chat-card__send"
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Отправить"
        >
          <IconArrowUp aria-hidden="true" />
        </button>
      </form>

      {sendError && (
        <p className="chat-card__error" role="alert">
          {sendError}
        </p>
      )}
    </div>
  );
}
