import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';
import { api } from '../api.js';
import MembersPanel from '../components/MembersPanel.jsx';
import './Page.css';
import './ClubPage.css';

// Временные данные: заменим на API, когда появится таблица club_members
const DEMO_MEMBERS = [
  { id: 1, name: 'Ким Тимур Андреевич', role: 'member' },
  { id: 2, name: 'Нурланова Айгерим Ержанқызы', role: 'lead' },
  { id: 3, name: 'Бекова Марат Сериковна', role: 'member' },
  { id: 4, name: 'Жумабаева Асель Бекқызы', role: 'member' },
];

const DEMO_REQUESTS = [
  { id: 11, name: 'Сапаров Ерлан Маратович' },
  { id: 12, name: 'Абенова Дана Сериковна' },
];

/** Страница клуба. Слева — сведения, справа — управление участниками. */
export default function ClubPage() {
  const { id } = useParams();
  const [club, setClub] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .club(id)
      .then(({ club }) => setClub(club))
      .catch((failure) => setError(failure.message));
  }, [id]);

  return (
    <main className="page">
      <div className="club-page">
        <div className="club-page__main">
          <div className="club-head">
            {/* Возврат назван разделом, а не «Назад»: так видно, куда именно ведёт */}
            <Link className="page__back" to="/clubs" viewTransition>
              <IoChevronBack aria-hidden="true" />
              Клубы
            </Link>

            {club && <h1 className="page__title">{club.name}</h1>}
          </div>

          {error && (
            <p className="page__error" role="alert">
              {error}
            </p>
          )}

          {/* Карточка сведений о клубе: наполним на следующем шаге */}
          <div className="club-page__card" />
        </div>

        <aside className="club-page__side">
          <div className="side-header">
            <h2 className="side-header__title">Управление участниками</h2>
          </div>

          <MembersPanel members={DEMO_MEMBERS} requests={DEMO_REQUESTS} />
        </aside>
      </div>
    </main>
  );
}
