import { Link } from 'react-router-dom';
import { STATUS_LABELS, membersLabel } from '../club.js';
import './ClubCard.css';

/** Карточка клуба. Шапка по образцу виджетов: название, строка контекста, действие. */
export default function ClubCard({ id, name, members = 0, status = 'active', photo }) {
  return (
    <Link className="club" to={`/clubs/${id}`} viewTransition>
      <div className="club__header">
        <div className="club__title">
          <h2 className="club__name">{name}</h2>
          <p className="club__meta">
            {membersLabel(members)} · {STATUS_LABELS[status] ?? status}
          </p>
        </div>
      </div>

      <div className="club__body">
        {photo && <img className="club__photo" src={photo} alt="" />}
      </div>
    </Link>
  );
}
