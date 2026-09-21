import { useState } from 'react';
import { IoAdd } from 'react-icons/io5';
import ClubCard from '../components/ClubCard.jsx';
import ClubFormModal from '../components/ClubFormModal.jsx';
import airecLogo from '../assets/airec_logo.png';
import './Page.css';
import './Clubs.css';

// Временные данные: заменим на запрос к API, когда появится таблица clubs
const INITIAL_CLUBS = [
  { id: 1, name: 'AIREC', members: 42, status: 'active', photo: airecLogo },
];

export default function Clubs() {
  const [clubs, setClubs] = useState(INITIAL_CLUBS);
  const [formOpen, setFormOpen] = useState(false);

  function addClub({ name, photo }) {
    setClubs((prev) => [...prev, { id: Date.now(), name, members: 0, status: 'active', photo }]);
  }

  return (
    <main className="page">
      <div className="clubs">
        {clubs.map((club) => (
          <ClubCard
            key={club.id}
            name={club.name}
            members={club.members}
            status={club.status}
            photo={club.photo}
          />
        ))}

        <button className="club-add" type="button" onClick={() => setFormOpen(true)}>
          <IoAdd aria-hidden="true" />
          Создать клуб
        </button>
      </div>

      <ClubFormModal open={formOpen} onClose={() => setFormOpen(false)} onCreate={addClub} />
    </main>
  );
}
