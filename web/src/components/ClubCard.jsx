import { plural } from '../plural.js';
import './ClubCard.css';

const STATUS = {
  active: { label: 'Активен', tone: 'active' },
  pending: { label: 'На рассмотрении', tone: 'pending' },
  suspended: { label: 'Закрыт', tone: 'suspended' },
};

/** «Нурланова Айгерим Ержанқызы» → «Айгерим Н.» */
function shortName(fullName) {
  const [last, first] = fullName.trim().split(/\s+/);
  return first ? `${first} ${last[0]}.` : last;
}

function members(count) {
  if (!count) return 'Нет участников';
  return `${count} ${plural(count, ['участник', 'участника', 'участников'])}`;
}

export default function ClubCard({ club }) {
  const status = STATUS[club.status] ?? STATUS.active;

  return (
    <article className="club">
      {/* Пока логотипов нет — первая буква названия на фирменном фоне */}
      <div className="club__logo" aria-hidden="true">
        {club.name.trim()[0].toUpperCase()}
      </div>

      <h2 className="club__name">{club.name}</h2>
      <p className="club__lead">{club.lead ? shortName(club.lead) : 'Руководитель не назначен'}</p>

      <p className="club__members">{members(club.members)}</p>

      <p className={`club__status club__status--${status.tone}`}>
        <span className="club__dot" aria-hidden="true" />
        {status.label}
      </p>
    </article>
  );
}
