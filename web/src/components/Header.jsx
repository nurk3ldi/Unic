import { useState } from 'react';
import logo from '../assets/logo.png';
import InvitesBell from './InvitesBell.jsx';
import SearchField from './SearchField.jsx';
import './Header.css';

/**
 * Верхняя полоса: слева знак, справа поиск и колокольчик приглашений.
 *
 * **Поиск пока ничего не ищет.** Поле набирается и очищается, но общего поиска
 * по клубам и переписке в проекте ещё нет — он делается отдельно.
 */
export default function Header() {
  const [query, setQuery] = useState('');

  return (
    <header className="header">
      <img className="header__logo" src={logo} alt="Unic" width="72" />

      <div className="header__end">
        <div className="header__search">
          <SearchField
            label="Поиск"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery('')}
          />
        </div>

        {/* Приглашения в клубы */}
        <InvitesBell />
      </div>
    </header>
  );
}
