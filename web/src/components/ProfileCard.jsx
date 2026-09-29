import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { initial } from '../people.js';
import './ProfileCard.css';

/**
 * Визитка в левом верхнем углу: своё фото, имя и никнейм. Она же — вход в профиль
 * (сейчас единственный: навигация временно убрана).
 *
 * Нет фото — буква имени, как в остальных списках: карточка не пустует.
 */
export default function ProfileCard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <NavLink className="me-card" to="/profile" viewTransition>
      <span className="me-card__photo">
        {user.photo ? <img src={user.photo} alt="" /> : initial(user.fullName)}
      </span>

      {/* Имя — как в профиле, целиком: это своя визитка, а не строка чужого
          списка. Длинное ФИО переносится по словам, карточка под него растёт */}
      <span className="me-card__body">
        <span className="me-card__name">{user.fullName}</span>
        <span className="me-card__nick">@{user.username}</span>
      </span>
    </NavLink>
  );
}
