import { useEffect, useState } from 'react';
import { IoAdd } from 'react-icons/io5';
import { api } from '../api.js';
import ClubCard from '../components/ClubCard.jsx';
import ClubFormModal from '../components/ClubFormModal.jsx';
import './Page.css';
import './Clubs.css';

export default function Clubs() {
  const [clubs, setClubs] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .clubs()
      .then(({ clubs }) => setClubs(clubs))
      .catch((failure) => setError(failure.message));
  }, []);

  async function addClub({ name, photo }) {
    const { club } = await api.createClub({ name, photo });
    setClubs((prev) => [...prev, club]);
  }

  return (
    <main className="page">
      {error && (
        <p className="clubs__error" role="alert">
          {error}
        </p>
      )}

      <div className="clubs">
        {clubs.map((club) => (
          <ClubCard
            key={club.id}
            id={club.id}
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
