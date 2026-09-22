import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';
import { api } from '../api.js';
import { STATUS_LABELS, membersLabel } from '../club.js';
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
          {error && (
            <p className="page__error" role="alert">
              {error}
            </p>
          )}

          {/* Верхний ряд делится по ширине на две отдельные карточки */}
          <div className="club-top">
            {/* Возврат, название, фото и сведения о клубе */}
            <div className="club-card">
              {/* Возврат назван разделом, а не «Назад»: так видно, куда именно ведёт */}
              <div className="card-header">
                <Link className="card-header__back" to="/clubs" viewTransition>
                  <IoChevronBack aria-hidden="true" />
                  Клубы
                </Link>
              </div>

              {club && (
                <div className="club-hero">
                  <div className="club-hero__photo">
                    {club.photo ? (
                      <img className="club-hero__image" src={club.photo} alt="" />
                    ) : (
                      <span className="club-hero__letter" aria-hidden="true">
                        {club.name.trim()[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="club-hero__info">
                    <h1 className="page__title">{club.name}</h1>

                    <p className={`club-hero__status club-hero__status--${club.status}`}>
                      <span className="club-hero__dot" aria-hidden="true" />
                      {STATUS_LABELS[club.status] ?? club.status} · {membersLabel(club.members)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Управление самим клубом — рядом с управлением участниками */}
            <div className="club-card">
              <div className="card-header">
                <h2 className="card-header__title">Управление клубом</h2>
              </div>
            </div>
          </div>

          {/* Нижний ряд: слева квадрат, справа — остаток ширины */}
          <div className="club-bottom">
            {/* Чат клуба: здесь будет свёрнутый вид, по нажатию — переход в чат */}
            <div className="club-card">
              <div className="card-header">
                <h2 className="card-header__title">Чат</h2>
              </div>
            </div>

            {/* События клуба — наполним, когда появится таблица */}
            <div className="club-card">
              <div className="card-header">
                <h2 className="card-header__title">События</h2>
              </div>
            </div>
          </div>
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
