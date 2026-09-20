import { IoLogOutOutline } from 'react-icons/io5';
import { useAuth } from '../AuthContext.jsx';
import logo from '../assets/logo.png';
import './Header.css';

const ROLE_LABELS = {
  admin: 'Администратор',
  university: 'Университет',
  club_lead: 'Руководитель клуба',
  student: 'Студент',
};

/** Верхняя панель: полупрозрачный слой, контент прокручивается под ним. */
export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="header">
      <div className="header__inner">
        <img className="header__logo" src={logo} alt="Unic" width="76" />

        <div className="header__user">
          <div className="header__identity">
            <span className="header__name">{user.fullName}</span>
            <span className="header__role">{ROLE_LABELS[user.role] ?? user.role}</span>
          </div>

          <button className="header__signout" type="button" onClick={signOut} title="Выйти">
            <IoLogOutOutline aria-hidden="true" />
            <span className="visually-hidden">Выйти</span>
          </button>
        </div>
      </div>
    </header>
  );
}
