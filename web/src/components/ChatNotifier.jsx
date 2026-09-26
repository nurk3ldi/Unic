import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { POLL_MS } from '../chat.js';
import { shortName } from '../people.js';

/**
 * Системные уведомления о новых сообщениях. Ничего не рисует — только слушает.
 *
 * Живёт в каркасе, а не на экране чатов: оповещение нужно как раз тогда,
 * когда человек не в переписке — на другом экране или в другой вкладке.
 * Поэтому, в отличие от ленты, опрос не останавливается на скрытой вкладке.
 *
 * Молчит о своём, о выключенных чатах (chat.muted) и о разговоре, который
 * открыт прямо перед глазами. Пока браузер не разрешил уведомления, сервер
 * не спрашивается вовсе.
 */
export default function ChatNotifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Адрес читает таймер, а не рендер — держим свежим в ref
  const path = useRef(pathname);
  path.current = pathname;

  useEffect(() => {
    if (!('Notification' in window)) return undefined;

    let alive = true;
    let seen = null; // id чата → id последнего сообщения, которое уже видели

    async function check() {
      // Разрешения нет — не с чем идти к серверу. Сбрасываем память: после
      // разрешения первый опрос только запомнит, а не выстрелит всем старым
      if (Notification.permission !== 'granted') {
        seen = null;
        return;
      }

      try {
        const { chats } = await api.chats();
        if (!alive) return;

        if (seen) {
          for (const chat of chats) {
            const last = chat.last;
            if (!last || last.id === seen.get(chat.id)) continue;
            if (last.authorId === user.id || chat.muted) continue;
            if (!document.hidden && path.current === `/chats/${chat.id}`) continue;

            // tag: новое сообщение того же чата заменяет прошлое оповещение, а не копится
            const note = new Notification(chat.name, {
              body: `${shortName(last.author)}: ${last.text || 'Фото'}`,
              icon: '/favicon.png',
              tag: chat.id,
            });
            note.onclick = () => {
              window.focus();
              navigate(`/chats/${chat.id}`);
              note.close();
            };
          }
        }

        seen = new Map(chats.map((chat) => [chat.id, chat.last?.id ?? null]));
      } catch {
        // Сеть моргнула — спросим на следующем круге
      }
    }

    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user.id, navigate]);

  return null;
}
