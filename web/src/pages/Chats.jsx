import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { POLL_MS, chatStamp } from '../chat.js';
import { initial, shortName } from '../people.js';
import './Page.css';
import './Chats.css';

/**
 * Список чатов: по одному на клуб, где человек состоит.
 *
 * Свежий разговор сверху — порядок задаёт сервер, а не порядок вступления.
 * Список тоже опрашивается: иначе он врал бы о том, где уже ответили.
 */
export default function Chats() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      if (document.hidden) return;
      try {
        const { chats } = await api.chats();
        if (alive) {
          setChats(chats);
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
  }, []);

  return (
    <main className="page">
      <div className="chats">
        <div className="card-header">
          <h1 className="card-header__title">Чаты</h1>
        </div>

        {loading ? (
          <p className="chats__empty">Загружаем…</p>
        ) : error ? (
          <p className="chats__empty" role="alert">
            {error}
          </p>
        ) : chats.length === 0 ? (
          <p className="chats__empty">
            Вы пока не состоите в клубах — чату неоткуда взяться.
          </p>
        ) : (
          <ul className="chats__list">
            {chats.map((chat) => (
              <li key={chat.id}>
                <Link className="chat-row" to={`/clubs/${chat.id}/chat`} viewTransition>
                  <span className="chat-row__photo">
                    {chat.photo ? (
                      <img className="chat-row__image" src={chat.photo} alt="" />
                    ) : (
                      <span aria-hidden="true">{initial(chat.name)}</span>
                    )}
                  </span>

                  <span className="chat-row__body">
                    <span className="chat-row__name">{chat.name}</span>
                    <span className="chat-row__last">
                      {chat.last ? (
                        <>
                          <span className="chat-row__author">{shortName(chat.last.author)}:</span>{' '}
                          {chat.last.text}
                        </>
                      ) : (
                        'Сообщений пока нет'
                      )}
                    </span>
                  </span>

                  {chat.last && (
                    <time className="chat-row__time" dateTime={chat.last.createdAt}>
                      {chatStamp(chat.last.createdAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
