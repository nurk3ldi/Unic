import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { IconUser } from '../icons.jsx';
import logo from '../assets/logo.png';
import SearchField from './SearchField.jsx';
import './Header.css';

/**
 * Верхняя полоса: слева знак, справа поиск и своё фото. Идёт во всю ширину —
 * и над панелью разделов тоже, поэтому знак стоит здесь, а не в ней: одно имя
 * приложения на экране, а не два.
 *
 * **Поиск пока ничего не ищет.** Поле набирается и очищается, но общего поиска
 * по клубам и переписке в проекте ещё нет — он делается отдельно.
 */
export default function Header() {
  const { user } = useAuth();
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

        {/* Профиль — отдельная страница: там сведения о себе и выход.
            Есть своё фото — кнопка и есть он сам; нет — общий значок */}
        <NavLink className="header__me" to="/profile" viewTransition aria-label="Профиль">
          {user?.photo ? (
            <img className="header__photo" src={user.photo} alt="" />
          ) : (
            <IconUser aria-hidden="true" />
          )}
        </NavLink>
      </div>
    </header>
  );
}
