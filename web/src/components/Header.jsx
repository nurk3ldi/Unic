import logo from '../assets/logo.png';
import InvitesBell from './InvitesBell.jsx';
import './Header.css';

/** Верхняя полоса: слева знак, справа колокольчик приглашений. */
export default function Header() {
  return (
    <header className="header">
      <img className="header__logo" src={logo} alt="Unic" width="72" />

      {/* Приглашения в клубы */}
      <InvitesBell />
    </header>
  );
}
