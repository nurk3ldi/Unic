import ClubCard from '../components/ClubCard.jsx';
import './Page.css';
import './Clubs.css';

// Временные данные: заменим на запрос к API, когда появится таблица clubs
const DEMO_CLUBS = [
  { id: 1, name: 'IT Club', lead: 'Нурланова Айгерим Ержанқызы', members: 42, status: 'active' },
];

export default function Clubs() {
  return (
    <main className="page">
      <div className="clubs">
        {DEMO_CLUBS.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
    </main>
  );
}
