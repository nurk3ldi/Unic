import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IoChevronBack, IoCameraOutline } from 'react-icons/io5';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { squareDataUrl } from '../photo.js';
import { STATUS_LABELS, membersLabel } from '../club.js';
import ClubControls from '../components/ClubControls.jsx';
import MembersPanel from '../components/MembersPanel.jsx';
import './Page.css';
import './ClubPage.css';

// Правят клуб те же роли, что и создают его
const CAN_EDIT = ['university', 'admin'];

/** Что держит форма, прочитанное из записи клуба. */
const formOf = (club) => ({
  name: club?.name ?? '',
  description: club?.description ?? '',
  photo: club?.photo ?? null,
});

/** Страница клуба. Слева — сведения, справа — управление участниками. */
export default function ClubPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const fileRef = useRef(null);

  const [club, setClub] = useState(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => formOf(null));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    api
      .club(id)
      .then(({ club }) => setClub(club))
      .catch((failure) => setError(failure.message));
  }, [id]);

  // Запись приходит после первого рендера — без этого форма осталась бы пустой.
  // Клуб меняется только при загрузке и после сохранения, так что поверх
  // набираемого текста это не ляжет.
  useEffect(() => {
    setForm(formOf(club));
  }, [club]);

  const mayEdit = club && CAN_EDIT.includes(user?.role);

  // Сравнение с записью, а не отдельный флаг: флаг надо гасить в каждом пути,
  // который сохраняет или откатывает, а сравнение не может устареть.
  const isDirty = JSON.stringify(form) !== JSON.stringify(formOf(club));

  async function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // чтобы тот же файл можно было выбрать снова
    if (!file) return;

    try {
      const photo = await squareDataUrl(file);
      setForm((was) => ({ ...was, photo }));
      setFormError('');
    } catch {
      setFormError('Не удалось прочитать изображение');
    }
  }

  /**
   * «Готово» и есть сохранение: отдельная кнопка «Сохранить» была бы второй
   * кнопкой для одного намерения — ты закончил править и хочешь, чтобы это
   * осталось. Ничего не менялось — ничего не отправляется.
   */
  async function commit() {
    if (!isDirty) return true;

    if (form.name.trim().length < 2) {
      setFormError('Укажите название клуба');
      return false;
    }

    setSaving(true);
    try {
      const { club: saved } = await api.updateClub(id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        photo: form.photo,
      });
      setClub(saved);
      setFormError('');
      return true;
    } catch (failure) {
      // Оставляем как набрано: неудавшееся сохранение всё ещё хотят сохранить
      setFormError(failure.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Панель сама знает состав; страница держит только число рядом с названием
  const syncMembers = useCallback(
    (count) => setClub((current) => (current ? { ...current, members: count } : current)),
    [],
  );

  async function done() {
    if (await commit()) setEditing(false);
  }

  // Назад к записи, а не в пустоту: форма — копия записи, поэтому отказ от
  // правки это просто перечитать её
  function cancel() {
    setForm(formOf(club));
    setFormError('');
    setEditing(false);
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
                {/* Возврат назван разделом, а не «Назад»: так видно, куда именно ведёт */}
                <Link className="card-header__back" to="/clubs" viewTransition>
                  <IoChevronBack aria-hidden="true" />
                  Клубы
                </Link>

                {mayEdit && (
                  <div className="card-header__actions">
                    {/* Ряд раскрывается, чтобы впустить «Отмену»: она — прямое
                        следствие нажатия «Редактировать», поэтому должна откуда-то
                        приехать, а не оказаться на месте следующим кадром */}
                    <div className={`reveal-x${editing ? ' reveal-x--open' : ''}`}>
                      <div className="reveal-x__clip">
                        <button
                          className="card-header__action"
                          type="button"
                          onClick={cancel}
                          disabled={saving}
                          tabIndex={editing ? undefined : -1}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>

                    <button
                      className={`card-header__action${editing ? ' card-header__action--primary' : ''}`}
                      type="button"
                      onClick={() => (editing ? done() : setEditing(true))}
                      disabled={saving}
                    >
                      {saving ? 'Сохраняем…' : editing ? 'Готово' : 'Редактировать'}
                    </button>
                  </div>
                )}
              </div>

              {club && (
                <div className="club-hero">
                  {/* Фото остаётся на месте, меняется только то, что оно кликабельно */}
                  <button
                    className={`club-hero__photo${editing ? ' club-hero__photo--editing' : ''}`}
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Изменить фото клуба"
                    /* Вне правки снимок — просто снимок: inert убирает его
                       и из фокуса, и из дерева доступности, и из-под курсора */
                    inert={!editing || undefined}
                  >
                    {form.photo ? (
                      <img className="club-hero__image" src={form.photo} alt="" />
                    ) : (
                      <span className="club-hero__letter" aria-hidden="true">
                        {(form.name.trim()[0] ?? '?').toUpperCase()}
                      </span>
                    )}

                    <span className="club-hero__change">
                      <IoCameraOutline aria-hidden="true" />
                      Изменить фото
                    </span>
                  </button>

                  <div className="club-hero__info">
                    {/* Поля не подменяются на текст и обратно: значение видно всегда,
                        а правка снимает с них только запрет на ввод (readOnly, не disabled —
                        disabled гасит ровно то, что пришли прочитать) */}
                    <label className="visually-hidden" htmlFor="club-name">
                      Название клуба
                    </label>
                    <input
                      id="club-name"
                      className={`club-field club-field--name${editing ? ' club-field--editing' : ''}`}
                      value={form.name}
                      readOnly={!editing}
                      tabIndex={editing ? undefined : -1}
                      onChange={(event) => {
                        setForm((was) => ({ ...was, name: event.target.value }));
                        setFormError('');
                      }}
                    />

                    <p className={`club-hero__status club-hero__status--${club.status}`}>
                      <span className="club-hero__dot" aria-hidden="true" />
                      {STATUS_LABELS[club.status] ?? club.status} · {membersLabel(club.members)}
                    </p>

                    <label className="visually-hidden" htmlFor="club-about">
                      Информация о клубе
                    </label>
                    <textarea
                      id="club-about"
                      className={`club-field club-field--about${editing ? ' club-field--editing' : ''}`}
                      value={form.description}
                      placeholder={editing ? 'Информация о клубе' : ''}
                      readOnly={!editing}
                      tabIndex={editing ? undefined : -1}
                      onChange={(event) =>
                        setForm((was) => ({ ...was, description: event.target.value }))
                      }
                    />

                    <div className={`reveal-y${formError ? ' reveal-y--open' : ''}`}>
                      <div className="reveal-y__clip">
                        <p className="club-hero__error" role="alert">
                          {formError}
                        </p>
                      </div>
                    </div>
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

              {club && (
                <ClubControls club={club} canManage={Boolean(mayEdit)} onUpdated={setClub} />
              )}
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

          <MembersPanel clubId={id} onCountChange={syncMembers} />
        </aside>
      </div>
    </main>
  );
}
