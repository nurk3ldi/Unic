import { NavLink } from 'react-router-dom';
import { IoLogOutOutline, IoPersonCircleOutline } from 'react-icons/io5';
import { useAuth } from '../AuthContext.jsx';
import logo from '../assets/logo.png';
import './Header.css';

const ROLE_LABELS = {
  admin: 'Администратор',
  university: 'Университет',
  club_lead: 'Руководитель клуба',
  student: 'Студент',
};

/** Верхняя панель: полупрозрачный слой во всю ширину, контент течёт под ним. */
export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__left">
          <img className="header__logo" src={logo} alt="Unic" width="72" />

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
        </div>

        <button
          className="header__avatar"
          type="button"
          popoverTarget="profile-menu"
          title="Профиль"
        >
          <IoPersonCircleOutline aria-hidden="true" />
          <span className="visually-hidden">Профиль</span>
        </button>
      </div>

      {/* Нативный popover: закрывается кликом вне и клавишей Esc — без своего JS */}
      <div className="header__menu" id="profile-menu" popover="auto">
        <div className="header__menu-head">
          <span className="header__menu-name">{user.fullName}</span>
          <span className="header__menu-role">{ROLE_LABELS[user.role] ?? user.role}</span>
        </div>

        <button className="header__menu-item" type="button" onClick={signOut}>
          <IoLogOutOutline aria-hidden="true" />
          Выйти
        </button>
      </div>
    </header>
  );
}
