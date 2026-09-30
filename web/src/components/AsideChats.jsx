import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { badgeCount } from '../chat.js';
import { useLive } from '../live.js';
import { initial } from '../people.js';
import AsideHead from './AsideHead.jsx';
import './AsideChats.css';

// Страховка на случай, если поток молчит: список и сам переспросит
const POLL_MS = 60_000;

/**
 * Чаты в правой колонке: снимок клуба, название и сколько непрочитанного.
 * Строка ведёт прямо в переписку.
 *
 * Список обновляется по потоку событий (`useLive`) — тому же, что и лента чата:
 * новое сообщение меняет счётчик сразу, а не через опрос. Опрос остался
 * страховкой на случай оборванного потока.
 */
export default function AsideChats() {
  const [chats, setChats] = useState([]);

  const load = useCallback(() => {
    if (document.hidden) return;
    api
      .chats()
      .then(({ chats }) => setChats(chats))
      .catch(() => {
        // Молча: колонка — не место для ошибок сети, следующий опрос попробует снова
      });
  }, []);

  useLive(load);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  // Нет переписок — нет и раздела: пустой заголовок ни о чём не говорит
  if (chats.length === 0) return null;

  return (
    <>
      <AsideHead title="Чаты" value={badgeCount(chats.length)} />

      <nav className="aside-chats" aria-label="Чаты">
        {chats.map((chat) => (
          <NavLink
            key={chat.id}
            className="aside-chats__row"
            to={`/chats/${chat.id}`}
            viewTransition
          >
            <span className="aside-chats__photo">
              {chat.photo ? <img src={chat.photo} alt="" /> : initial(chat.name)}
            </span>

            <span className="aside-chats__name">{chat.name}</span>

            {chat.unread > 0 && (
              <span className="aside-chats__badge" aria-label={`Непрочитанных: ${chat.unread}`}>
                {badgeCount(chat.unread)}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
