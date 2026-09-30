import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { badgeCount } from '../chat.js';
import { IconDots, IconPin } from '../icons.jsx';
import { useLive } from '../live.js';
import { initial } from '../people.js';
import AsideHead from './AsideHead.jsx';
import './AsideChats.css';

// Страховка на случай, если поток молчит: список и сам переспросит
const POLL_MS = 60_000;

/** Закреплённые — наверху, позже закреплённый выше; остальные — как прислал сервер. */
function byPin(a, b) {
  return (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? '');
}

/**
 * Чаты в правой колонке: снимок клуба, название и сколько непрочитанного.
 * Строка ведёт прямо в переписку, «···» справа открывает меню строки.
 *
 * Список обновляется по потоку событий (`useLive`) — тому же, что и лента чата:
 * новое сообщение меняет счётчик сразу, а не через опрос. Опрос остался
 * страховкой на случай оборванного потока.
 */
export default function AsideChats() {
  const [chats, setChats] = useState([]);
  // Чей «···» нажат: меню одно на весь список. Хранится id, а сам чат берётся
  // из свежего списка — иначе после обновления меню показывало бы старое
  const [targetId, setTargetId] = useState(null);
  const menuRef = useRef(null);

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

  /**
   * Меню открывает сам браузер (popovertarget), здесь — только чьё оно и где:
   * встаёт под кнопкой, правым краем к её правому краю. Лежит в верхнем слое,
   * поэтому прокручиваемая карточка его не обрезает.
   */
  function aim(event, chat) {
    const rect = event.currentTarget.getBoundingClientRect();
    const menu = menuRef.current;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    setTargetId(chat.id);
  }

  /** Сразу переставляет строку, сервер подтверждает; не вышло — список перечитывается. */
  function togglePin(chat) {
    menuRef.current.hidePopover();
    const pinned = !chat.pinnedAt;
    setChats((list) =>
      list.map((item) =>
        item.id === chat.id
          ? { ...item, pinnedAt: pinned ? new Date().toISOString() : null }
          : item,
      ),
    );
    api.pinChat(chat.id, pinned).catch(load);
  }

  // Нет переписок — нет и раздела: пустой заголовок ни о чём не говорит
  if (chats.length === 0) return null;

  const target = chats.find((chat) => chat.id === targetId);

  return (
    <>
      <AsideHead title="Чаты" value={badgeCount(chats.length)} />

      <nav className="aside-chats" aria-label="Чаты">
        {[...chats].sort(byPin).map((chat) => (
          <div key={chat.id} className="aside-chats__row">
            {/* Ссылка растянута на всю строку (::after), кнопка лежит поверх неё */}
            <NavLink className="aside-chats__link" to={`/chats/${chat.id}`} viewTransition>
              <span className="aside-chats__photo">
                {chat.photo ? <img src={chat.photo} alt="" /> : initial(chat.name)}
              </span>

              <span className="aside-chats__name">{chat.name}</span>

              {chat.pinnedAt && (
                <span className="aside-chats__pin" aria-label="Закреплён">
                  <IconPin />
                </span>
              )}

              {chat.unread > 0 && (
                <span className="aside-chats__badge" aria-label={`Непрочитанных: ${chat.unread}`}>
                  {badgeCount(chat.unread)}
                </span>
              )}
            </NavLink>

            <button
              className="aside-chats__more"
              type="button"
              aria-label={`Действия с чатом: ${chat.name}`}
              popoverTarget="aside-chat-menu"
              onClick={(event) => aim(event, chat)}
            >
              <IconDots />
            </button>
          </div>
        ))}
      </nav>

      <div
        ref={menuRef}
        id="aside-chat-menu"
        className="row-menu aside-chats__menu"
        popover="auto"
      >
        {target && (
          <button className="row-menu__item" type="button" onClick={() => togglePin(target)}>
            <IconPin />
            {target.pinnedAt ? 'Открепить' : 'Закрепить'}
          </button>
        )}
      </div>
    </>
  );
}
