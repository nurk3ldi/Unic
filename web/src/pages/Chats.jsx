import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { IoChatbubblesOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { api } from '../api.js';
import { POLL_MS, chatStamp } from '../chat.js';
import { initial, shortName } from '../people.js';
import ChatRoom from '../components/ChatRoom.jsx';
import SearchField from '../components/SearchField.jsx';
import './Page.css';
import './Chats.css';

/**
 * Чаты: слева список, справа открытый разговор — две панели в одной карточке,
 * разделённые волоском. Так видно, где ещё говорят, не выходя из переписки.
 *
 * Первым в списке — общий чат университета: он есть у всех и потому не зависит
 * от состава клубов. Он же открыт по умолчанию, на пустой адрес `/chats`:
 * пустая правая панель ничего не говорила бы о том, что здесь делают.
 *
 * Дальше — клубы, где человек состоит: список отвечает на вопрос «где я
 * переписываюсь». Управляющие роли открывают чужой чат со страницы клуба.
 *
 * Разговор живёт в адресе (`/chats/:id`): ссылку можно переслать, а «назад»
 * возвращает к списку, а не к предыдущему клубу.
 */
export default function Chats() {
  const { id } = useParams();

  const [chats, setChats] = useState([]);
  const [general, setGeneral] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      if (document.hidden) return;
      try {
        const { chats, general } = await api.chats();
        if (alive) {
          setChats(chats);
          setGeneral(general);
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

  const open = chats.find((chat) => chat.id === id) ?? null;

  // Ищем и по названию клуба, и по последней реплике: в списке видно и то, и другое
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return chats;

    return chats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(query) ||
        chat.last?.text.toLowerCase().includes(query),
    );
  }, [chats, search]);

  return (
    <main className="page">
      {/* На узком экране видно что-то одно: список либо разговор */}
      <div className={`chats${id ? ' chats--open' : ''}`}>
        <div className="chats__side">
          <div className="card-header">
            <h1 className="card-header__title">Чаты</h1>
          </div>

          <SearchField
            label="Поиск чата"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch('')}
          />

          {loading ? (
            <p className="chats__empty">Загружаем…</p>
          ) : error ? (
            <p className="chats__empty" role="alert">
              {error}
            </p>
          ) : (
            <ul className="chats__list">
              {/* Общий чат не фильтруется поиском: он один и всегда на месте */}
              <li>
                <NavLink className="chat-row" to="/chats" end viewTransition>
                  <span className="chat-row__photo chat-row__photo--general">
                    <IoChatbubblesOutline aria-hidden="true" />
                  </span>

                  <span className="chat-row__body">
                    <span className="chat-row__name">Общий чат</span>
                    <span className="chat-row__last">
                      {general?.last ? (
                        <>
                          <span className="chat-row__author">
                            {shortName(general.last.author)}:
                          </span>{' '}
                          {general.last.text}
                        </>
                      ) : (
                        'Весь университет'
                      )}
                    </span>
                  </span>

                  {general?.last && (
                    <time className="chat-row__time" dateTime={general.last.createdAt}>
                      {chatStamp(general.last.createdAt)}
                    </time>
                  )}
                </NavLink>
              </li>

              {visible.map((chat) => (
                <li key={chat.id}>
                  <NavLink className="chat-row" to={`/chats/${chat.id}`} viewTransition>
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
                            <span className="chat-row__author">
                              {shortName(chat.last.author)}:
                            </span>{' '}
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
                  </NavLink>
                </li>
              ))}

              {visible.length === 0 && (
                <li>
                  <p className="chats__empty">
                    {search ? 'Ничего не нашли' : 'Клубных чатов пока нет'}
                  </p>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="chats__room">
          <div className="card-header">
            {/* На узком экране шапка разговора — единственный путь назад */}
            <Link className="card-header__back chats__back" to="/chats" viewTransition>
              <IoChevronBack aria-hidden="true" />
              Чаты
            </Link>

            {id ? (
              /* Название ведёт в клуб: разговор — это часть клуба, а не остров */
              <Link className="card-header__action" to={`/clubs/${id}`} viewTransition>
                {open?.name ?? 'Клуб'}
                <IoChevronForward aria-hidden="true" />
              </Link>
            ) : (
              <h2 className="card-header__title">Общий чат</h2>
            )}
          </div>

          {/* key: смена разговора начинает ленту заново, а не дописывает чужую */}
          <ChatRoom key={id ?? 'general'} clubId={id ?? null} />
        </div>
      </div>
    </main>
  );
}
