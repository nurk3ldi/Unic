import ClubCard from '../components/ClubCard.jsx';
import { plural } from '../plural.js';
import './Page.css';
import './Clubs.css';

// Временные данные: заменим на запрос к API, когда появится таблица clubs
const DEMO_CLUBS = [
  { id: 1, name: 'IT Club', lead: 'Нурланова Айгерим Ержанқызы', members: 42, status: 'active' },
  { id: 2, name: 'Дебатный клуб', lead: 'Сапаров Ерлан Маратович', members: 18, status: 'pending' },
  { id: 3, name: 'Robotics', lead: null, members: 0, status: 'active' },
  { id: 4, name: 'Шахматный клуб', lead: 'Абенова Дана Сериковна', members: 27, status: 'active' },
  { id: 5, name: 'Медиацентр', lead: 'Ким Тимур Андреевич', members: 12, status: 'suspended' },
  { id: 6, name: 'Волонтёрское движение', lead: 'Жумабаева Асель Бекқызы', members: 63, status: 'active' },
];

export default function Clubs() {
  const pending = DEMO_CLUBS.filter((club) => club.status === 'pending').length;

  return (
    <main className="page">
      <header className="page__head">
        <h1 className="page__title">Клубы</h1>
        <p className="page__subtitle">
          {DEMO_CLUBS.length} {plural(DEMO_CLUBS.length, ['клуб', 'клуба', 'клубов'])}
          {pending > 0 &&
            ` · ${pending} ${plural(pending, ['заявка', 'заявки', 'заявок'])} на рассмотрении`}
        </p>
      </header>

      <div className="clubs">
        {DEMO_CLUBS.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
    </main>
  );
}
