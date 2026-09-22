import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IoChevronBack, IoCameraOutline } from 'react-icons/io5';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { squareDataUrl } from '../photo.js';
import { STATUS_LABELS, membersLabel } from '../club.js';
import MembersPanel from '../components/MembersPanel.jsx';
import './Page.css';
import './ClubPage.css';

// Временные данные: заменим на API, когда появится таблица club_members
const DEMO_MEMBERS = [
  { id: 1, name: 'Ким Тимур Андреевич', role: 'member' },
  { id: 2, name: 'Досжанов Алихан Ержанұлы', role: 'lead' },
  { id: 3, name: 'Бекова Марат Сериковна', role: 'member' },
  { id: 4, name: 'Жумабаева Асель Бекқызы', role: 'member' },
];

const DEMO_REQUESTS = [
  { id: 11, name: 'Сапаров Ерлан Маратович' },
  { id: 12, name: 'Абенова Дана Сериковна' },
];

// Правят клуб те же роли, что и создают его
const CAN_EDIT = ['university', 'admin'];

/** Страница клуба. Слева — сведения, справа — управление участниками. */
export default function ClubPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const fileRef = useRef(null);

  const [club, setClub] = useState(null);
  const [error, setError] = useState('');

  // Правка живёт в черновике: «Отмена» просто выбрасывает его
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    api
      .club(id)
      .then(({ club }) => setClub(club))
      .catch((failure) => setError(failure.message));
  }, [id]);

  const editing = draft !== null;
  const mayEdit = club && CAN_EDIT.includes(user?.role);

  function startEdit() {
    setDraft({ name: club.name, description: club.description ?? '', photo: club.photo });
    setFormError('');
  }

  async function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // чтобы тот же файл можно было выбрать снова
    if (!file) return;

    try {
      const photo = await squareDataUrl(file);
      setDraft((current) => ({ ...current, photo }));
      setFormError('');
    } catch {
      setFormError('Не удалось прочитать изображение');
    }
  }

  async function save() {
    setBusy(true);
    try {
      const { club: saved } = await api.updateClub(id, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        photo: draft.photo,
      });
      setClub(saved);
      setDraft(null);
    } catch (failure) {
      setFormError(failure.message);
    } finally {
      setBusy(false);
    }
  }

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
              <div className="card-header">
                {editing ? (
                  <button
                    className="card-header__action"
                    type="button"
                    onClick={() => setDraft(null)}
                    disabled={busy}
                  >
                    Отмена
                  </button>
                ) : (
                  /* Возврат назван разделом, а не «Назад»: так видно, куда именно ведёт */
                  <Link className="card-header__back" to="/clubs" viewTransition>
                    <IoChevronBack aria-hidden="true" />
                    Клубы
                  </Link>
                )}

                {mayEdit && (
                  <button
                    className={`card-header__action${editing ? ' card-header__action--primary' : ''}`}
                    type="button"
                    onClick={editing ? save : startEdit}
                    disabled={busy}
                  >
                    {editing ? (busy ? 'Сохраняем…' : 'Сохранить') : 'Редактировать'}
                  </button>
                )}
              </div>

              {club && (
                <div className="club-hero">
                  {editing ? (
                    <button
                      className="club-hero__photo club-hero__photo--editable"
                      type="button"
                      onClick={() => fileRef.current?.click()}
                    >
                      {draft.photo ? (
                        <img className="club-hero__image" src={draft.photo} alt="" />
                      ) : (
                        <span className="club-hero__letter" aria-hidden="true">
                          {draft.name.trim()[0]?.toUpperCase() ?? '?'}
                        </span>
                      )}

                      <span className="club-hero__change">
                        <IoCameraOutline aria-hidden="true" />
                        Изменить фото
                      </span>
                    </button>
                  ) : (
                    <div className="club-hero__photo">
                      {club.photo ? (
                        <img className="club-hero__image" src={club.photo} alt="" />
                      ) : (
                        <span className="club-hero__letter" aria-hidden="true">
                          {club.name.trim()[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="club-hero__info">
                    {editing ? (
                      <>
                        <label className="visually-hidden" htmlFor="club-name">
                          Название клуба
                        </label>
                        <input
                          id="club-name"
                          className="club-input club-input--name"
                          value={draft.name}
                          placeholder="Название клуба"
                          onChange={(event) => {
                            setDraft({ ...draft, name: event.target.value });
                            setFormError('');
                          }}
                        />

                        <label className="visually-hidden" htmlFor="club-about">
                          Информация о клубе
                        </label>
                        <textarea
                          id="club-about"
                          className="club-input club-input--about"
                          value={draft.description}
                          placeholder="Информация о клубе"
                          onChange={(event) =>
                            setDraft({ ...draft, description: event.target.value })
                          }
                        />

                        {formError && (
                          <p className="club-hero__error" role="alert">
                            {formError}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h1 className="page__title">{club.name}</h1>

                        <p className={`club-hero__status club-hero__status--${club.status}`}>
                          <span className="club-hero__dot" aria-hidden="true" />
                          {STATUS_LABELS[club.status] ?? club.status} · {membersLabel(club.members)}
                        </p>

                        {club.description && <p className="club-hero__about">{club.description}</p>}
                      </>
                    )}
                  </div>

                  <input
                    ref={fileRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/*"
                    onChange={pickPhoto}
                  />
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
