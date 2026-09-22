import { Link } from 'react-router-dom';
import './ClubCard.css';

const STATUS_LABELS = {
  active: 'Активен',
  pending: 'На рассмотрении',
  suspended: 'Закрыт',
};

/** Русские формы: 1 участник, 2 участника, 5 участников */
function membersLabel(count) {
  if (!count) return 'Нет участников';
  const ten = count % 10;
  const hundred = count % 100;
  if (ten === 1 && hundred !== 11) return `${count} участник`;
  if (ten >= 2 && ten <= 4 && (hundred < 10 || hundred >= 20)) return `${count} участника`;
  return `${count} участников`;
}

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
