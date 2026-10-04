import { Link } from 'react-router-dom';
import { STATUS_LABELS } from '../club.js';
import { initial } from '../people.js';
import './ClubCard.css';

/**
 * Карточка клуба — на том же языке, что публикация в ленте: белая, снимок
 * внутри полей, под ним название и состояние клуба.
 */
export default function ClubCard({ id, name, status = 'active', photo }) {
  return (
    <Link className="club" to={`/clubs/${id}`} viewTransition>
      {/* Снимка нет — первая буква названия: карточка не остаётся пустым квадратом */}
      <span className="club__photo">{photo ? <img src={photo} alt="" /> : initial(name)}</span>

      <h2 className="club__name">{name}</h2>
      <p className="club__meta">
        <span className={`club__dot club__dot--${status}`} />
        {STATUS_LABELS[status] ?? status}
      </p>
    </Link>
  );
}
