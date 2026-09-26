import { NavLink } from 'react-router-dom';
import { IoPersonCircleOutline } from 'react-icons/io5';
import { useAuth } from '../AuthContext.jsx';
import logo from '../assets/logo.png';
import './Header.css';

/** Верхняя панель: полупрозрачный слой во всю ширину, контент течёт под ним. */
export default function Header() {
  const { user } = useAuth();

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
          </NavLink>

          <NavLink className="header__link" to="/events" viewTransition>
            События
          </NavLink>
        </nav>

        {/* Профиль — отдельная страница: там сведения о себе и выход */}
        {/* Есть своё фото — кнопка и есть он сам, кружком; нет — общий значок */}
        <NavLink className="header__avatar" to="/profile" viewTransition aria-label="Профиль">
          {user?.photo ? (
            <img className="header__photo" src={user.photo} alt="" />
          ) : (
            <IoPersonCircleOutline aria-hidden="true" />
          )}
        </NavLink>
      </div>
    </header>
  );
}
