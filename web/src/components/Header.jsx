import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { IconUser } from '../icons.jsx';
import { useAuth } from '../AuthContext.jsx';
import logo from '../assets/logo.png';
import InvitesBell from './InvitesBell.jsx';
import './Header.css';

/** Верхняя панель: полупрозрачный слой во всю ширину, контент течёт под ним. */
export default function Header() {
  const { user } = useAuth();
  const location = useLocation();
  const unread = useUnread(location.pathname);

  return (
    <header className="header">
      <div className="header__inner">
        <img className="header__logo" src={logo} alt="Unic" width="72" />

        {/* Навигация — ровно по центру панели, независимо от ширины краёв */}
        <nav className="header__nav">
          <NavLink className="header__link" to="/" end viewTransition>
            Главная
          </NavLink>

          <NavLink className="header__link" to="/clubs" viewTransition>
            Клубы
          </NavLink>

          <NavLink className="header__link" to="/chats" viewTransition>
            Чаты
            {/* Сколько непрочитанного во всех чатах — чтобы знать, что там ждут */}
            {unread > 0 && (
              <span className="header__badge" aria-label={`Непрочитанных: ${unread}`}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </NavLink>

          <NavLink className="header__link" to="/events" viewTransition>
            События
          </NavLink>
        </nav>

        <div className="header__end">
          {/* Приглашения в клубы — рядом с профилем: это личное, как и он */}
          <InvitesBell />

          {/* Профиль — отдельная страница: там сведения о себе и выход */}
          {/* Есть своё фото — кнопка и есть он сам, кружком; нет — общий значок */}
          <NavLink className="header__avatar" to="/profile" viewTransition aria-label="Профиль">
            {user?.photo ? (
              <img className="header__photo" src={user.photo} alt="" />
            ) : (
              <IconUser aria-hidden="true" />
            )}
          </NavLink>
        </div>
      </div>
    </header>
  );
}

// Как часто шапка спрашивает число непрочитанного: чаще списка чатов не нужно
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
