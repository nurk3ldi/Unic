import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IoArrowUp, IoChevronBack } from 'react-icons/io5';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { POLL_MS, messageTime } from '../chat.js';
import { initial, shortName } from '../people.js';
import './Page.css';
import './ClubChat.css';

/**
 * Чат клуба.
 *
 * **Новое приходит опросом, а не сокетом.** Пять секунд для клубной переписки
 * незаметны, а WebSocket — это новая зависимость и своё состояние соединения;
 * §2 держит список закрытым, и пока цена не оправдана. Опрос останавливается,
 * когда вкладка скрыта: незачем будить сервер ради невидимого экрана.
 *
 * Лента всегда прокручена к последнему сообщению — читают её с конца.
 */
export default function ClubChat() {
  const { id } = useParams();
  const { user } = useAuth();

  const listRef = useRef(null);
  const inputRef = useRef(null);

  const [club, setClub] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api
      .club(id)
      .then(({ club }) => setClub(club))
      .catch((failure) => setError(failure.message));
  }, [id]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (document.hidden) return;
      try {
        const { messages } = await api.clubMessages(id);
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
  }, [id]);

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
      const { message } = await api.sendClubMessage(id, { text: body });
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
    <main className="page">
      <div className="chat">
        <div className="card-header">
          <Link className="card-header__back" to={`/clubs/${id}`} viewTransition>
            <IoChevronBack aria-hidden="true" />
            {club?.name ?? 'Клуб'}
          </Link>
        </div>

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
                    {!own && <span className="msg__author">{shortName(message.author)}</span>}
                    <p className="msg__text">{message.text}</p>
                    <time className="msg__time" dateTime={message.createdAt}>
                      {messageTime.format(new Date(message.createdAt))}
                    </time>
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
      </div>
    </main>
  );
}
