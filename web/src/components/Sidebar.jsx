import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { IconCalendar, IconChats, IconClubs, IconHome } from '../icons.jsx';
import InvitesBell from './InvitesBell.jsx';
import './Sidebar.css';

/**
 * Разделы по порядку. Порядок задан здесь, а не в разметке: по нему же считается,
 * на какой строке стоит подсветка, — иначе номер пришлось бы держать в двух местах.
 */
const SECTIONS = [
  { to: '/', end: true, label: 'Главная', Icon: IconHome },
  { to: '/clubs', label: 'Клубы', Icon: IconClubs },
  { to: '/chats', label: 'Чаты', Icon: IconChats },
  { to: '/events', label: 'События', Icon: IconCalendar },
];

/**
 * Боковая панель: узкий столбец значков у левого края, на телефоне — нижняя полоса.
 *
 * **Почему столбец, а не верхняя шапка.** Разделов немного, и они не меняются, а
 * рабочие экраны (чат, события) устроены колонками — панель встаёт первой колонкой
 * и ничего не отрезает сверху.
 *
 * **Подсветка — одна плашка на всю панель, а не фон у каждого значка.** Она едет
 * с раздела на раздел (`--index` → `translate`), поэтому видно, откуда и куда
 * перешли (§4.3). Едет только `transform`, движение прерываемо: щёлкнули по
 * третьему разделу на полпути ко второму — плашка развернётся с места, где есть.
 */
export default function Sidebar() {
  const { pathname } = useLocation();
  const unread = useUnread(pathname);

  // Профиль не раздел навигации — на нём подсветка гаснет, оставаясь на месте
  const active = SECTIONS.findIndex((section) =>
    section.end ? pathname === section.to : pathname.startsWith(section.to),
  );

  return (
    <nav className="rail" aria-label="Разделы">
      <div className="rail__nav">
        <span
          className={`rail__pill${active < 0 ? ' rail__pill--off' : ''}`}
          style={{ '--index': Math.max(active, 0) }}
          aria-hidden="true"
        />

        {SECTIONS.map(({ to, end, label, Icon }) => (
          <NavLink key={to} className="rail__item" to={to} end={end} viewTransition>
            <Icon aria-hidden="true" />

            {/* Сколько непрочитанного во всех чатах — чтобы знать, что там ждут */}
            {to === '/chats' && unread > 0 && (
              <span className="rail__badge" aria-hidden="true">
                {unread > 99 ? '99+' : unread}
              </span>
            )}

            {/* Значок без подписи узнаётся не всеми: имя раздела выезжает рядом.
                Оно же — подпись для чтения с экрана, отдельный aria-label не нужен */}
            <span className="rail__tip">{label}</span>
            {to === '/chats' && unread > 0 && (
              <span className="visually-hidden">, непрочитанных: {unread}</span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Приглашения в клубы — у нижнего края: их ждут, но зовут реже разделов.
          Профиль живёт в верхней полосе, рядом с поиском */}
      <div className="rail__end">
        <InvitesBell />
      </div>
    </nav>
  );
}

// Как часто панель спрашивает число непрочитанного: чаще списка чатов не нужно
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
