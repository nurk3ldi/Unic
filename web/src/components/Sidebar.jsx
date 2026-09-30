import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { badgeCount } from '../chat.js';
import { IconCalendar, IconChats, IconClubs, IconHome } from '../icons.jsx';
import './Sidebar.css';

/**
 * Разделы по порядку. Порядок задан здесь, а не в разметке: по нему же считается,
 * на какой строке стоит отметка, — иначе номер пришлось бы держать в двух местах.
 */
const SECTIONS = [
  { to: '/', end: true, label: 'Главная', Icon: IconHome },
  { to: '/clubs', label: 'Клубы', Icon: IconClubs },
  { to: '/chats', label: 'Чаты', Icon: IconChats },
  { to: '/events', label: 'События', Icon: IconCalendar },
];

/**
 * Разделы — списком в такой же белой карточке, что и визитка над ней.
 *
 * **Отметка открытого раздела — одна полоска на всю карточку**, а не рамка у
 * каждой строки: она переезжает со строки на строку (`--index` → `translate`),
 * поэтому видно, откуда и куда перешли (§4.3). Едет только `transform`, движение
 * прерываемо — нажали третий раздел на полпути ко второму, полоска развернётся
 * с того места, где есть.
 */
export default function Sidebar() {
  const { pathname } = useLocation();
  const unread = useUnread(pathname);

  // Профиль не раздел этого списка — на нём отметка гаснет, оставаясь на месте
  const active = SECTIONS.findIndex((section) =>
    section.end ? pathname === section.to : pathname.startsWith(section.to),
  );

  return (
    <nav className="side-nav" aria-label="Разделы">
      <span
        className={`side-nav__mark${active < 0 ? ' side-nav__mark--off' : ''}`}
        style={{ '--index': Math.max(active, 0) }}
        aria-hidden="true"
      />

      {SECTIONS.map(({ to, end, label, Icon }) => (
        <NavLink key={to} className="side-nav__item" to={to} end={end} viewTransition>
          <Icon aria-hidden="true" />
          <span className="side-nav__label">{label}</span>

          {/* Сколько непрочитанного во всех чатах — чтобы знать, что там ждут */}
          {to === '/chats' && unread > 0 && (
            <span className="side-nav__badge" aria-label={`Непрочитанных: ${unread}`}>
              {badgeCount(unread)}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// Как часто список спрашивает число непрочитанного: чаще списка чатов не нужно
const UNREAD_POLL_MS = 10_000;

/**
 * Сколько непрочитанного во всех чатах. Спрашивает отдельную лёгкую ручку
 * (одно число, без списка), раз в 10 секунд, при переходе между экранами и
 * когда вкладку вернули. Скрытая вкладка сервер не будит.
 */
function useUnread(pathname) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      !document.hidden &&
      api
        .chatsUnread()
        .then(({ total }) => alive && setTotal(total))
        .catch(() => {});

    load();
    const timer = setInterval(load, UNREAD_POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [pathname]);

  return total;
}
