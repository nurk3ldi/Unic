import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';
import { api } from '../api.js';
import './Page.css';
import './ClubPage.css';

/** Страница клуба. Пока только название — управление добавим следующим шагом. */
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
          {/* Возврат назван разделом, а не «Назад»: так видно, куда именно ведёт */}
          <Link className="page__back" to="/clubs" viewTransition>
            <IoChevronBack aria-hidden="true" />
            Клубы
          </Link>

          {error && (
            <p className="page__error" role="alert">
              {error}
            </p>
          )}

          {club && <h1 className="page__title">{club.name}</h1>}
        </div>

        {/* Боковая карточка: наполним на следующем шаге */}
        <aside className="club-page__side" />
      </div>
    </main>
  );
}
