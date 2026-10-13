import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { IconChevronDown, IconChevronLeft, IconImage } from '../icons.jsx';
import { chatPhoto } from '../photo.js';
import EventCard from '../components/EventCard.jsx';
import Field from '../components/Field.jsx';
import './Page.css';
import './CreateEvent.css';

// Те же пределы проверяет сервер (routes/clubs.js)
const TITLE_LIMIT = 120;
const PLACE_LIMIT = 200;
const NOTE_LIMIT = 1000;

const AUDIENCES = [
  { value: 'all', title: 'Для всех', note: 'Событие увидят все в Unic' },
  { value: 'club', title: 'Только клуб', note: 'Внутренняя встреча — увидят участники клуба' },
];

const EMPTY = { title: '', startsAt: '', place: '', note: '' };

/**
 * Новое событие: слева форма, справа — та самая карточка афиши, которая
 * заполняется по мере ввода. Добавляют университет и руководитель клуба —
 * остальным страница это и говорит.
 *
 * Обложку сжимает браузер, как снимок в чате, и она уходит вместе с остальным
 * одним запросом.
 */
export default function CreateEvent() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const clubFieldId = useId();
  const noteFieldId = useId();

  const [clubs, setClubs] = useState(null); // null — ещё не знаем, каким клубам можно добавлять
  const [club, setClub] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [audience, setAudience] = useState('all');
  const [photo, setPhoto] = useState(null); // data URL
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .eventTargets()
      .then(({ clubs }) => {
        if (!alive) return;
        setClubs(clubs);
        setClub(clubs[0]?.id ?? '');
      })
      .catch((failure) => alive && setErrors({ form: failure.message }));
    return () => {
      alive = false;
    };
  }, []);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '', form: '' }));
  }

  async function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // чтобы тот же файл можно было выбрать снова
    if (!file) return;

    try {
      setPhoto((await chatPhoto(file)).dataUrl);
      setErrors((current) => ({ ...current, photo: '' }));
    } catch {
      setErrors((current) => ({ ...current, photo: 'Не удалось открыть фото — выберите JPEG или PNG' }));
    }
  }

  async function publish(event) {
    event.preventDefault();

    const title = form.title.trim();
    const startsAt = new Date(form.startsAt);
    const found = {};
    if (title.length < 2) found.title = 'Укажите название события';
    // Number.isNaN у пустой или кривой даты — единственный способ её поймать
    if (Number.isNaN(startsAt.getTime())) found.startsAt = 'Укажите дату и время';
    if (found.title || found.startsAt) {
      setErrors(found);
      return;
    }

    setSending(true);
    try {
      await api.createClubEvent(club, {
        title,
        startsAt: startsAt.toISOString(),
        place: form.place.trim() || null,
        note: form.note.trim() || null,
        audience,
        photo,
      });
      navigate('/events', { viewTransition: true });
    } catch (failure) {
      setErrors({ form: failure.message });
      setSending(false);
    }
  }

  return (
    <main className="page">
      <Link className="page__back" to="/events" viewTransition>
        <IconChevronLeft aria-hidden="true" />
        События
      </Link>

      {clubs?.length === 0 ? (
        <div className="new-event__form">
          <h1 className="page__title">Новое событие</h1>
          <p className="new-event__hint">
            Добавлять события могут университет и руководитель клуба. Станьте руководителем
            клуба — и здесь появится форма.
          </p>
        </div>
      ) : (
        <div className="new-event">
          <form className="new-event__form" onSubmit={publish} noValidate>
            <h1 className="page__title">Новое событие</h1>

            <div className="new-event__block">
              <span className="new-event__label">Обложка</span>
              <button
                className={`photo-picker${photo ? ' photo-picker--filled' : ''}`}
                type="button"
                onClick={() => fileRef.current.click()}
              >
                {photo ? (
                  <img className="photo-picker__image" src={photo} alt="" />
                ) : (
                  <span className="photo-picker__hint">
                    <IconImage aria-hidden="true" />
                    Добавить обложку
                  </span>
                )}
              </button>
              <input
                className="visually-hidden"
                ref={fileRef}
                type="file"
                accept="image/*"
                tabIndex={-1}
                onChange={pickPhoto}
              />
              {errors.photo && (
                <p className="field__error" role="alert">
                  {errors.photo}
                </p>
              )}
            </div>

            <div className="field">
              <label className="visually-hidden" htmlFor={clubFieldId}>
                Клуб
              </label>
              <div className="field__box new-event__select">
                <select
                  id={clubFieldId}
                  className="field__input"
                  value={club}
                  onChange={(event) => setClub(event.target.value)}
                >
                  {(clubs ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <IconChevronDown aria-hidden="true" />
              </div>
            </div>

            <Field
              label="Название события"
              name="title"
              maxLength={TITLE_LIMIT}
              value={form.title}
              error={errors.title}
              onChange={change}
            />

            <Field
              label="Дата и время"
              name="startsAt"
              type="datetime-local"
              className={`new-event__date${form.startsAt ? '' : ' new-event__date--empty'}`}
              value={form.startsAt}
              error={errors.startsAt}
              onChange={change}
            />

            <Field
              label="Место"
              placeholder="Место — где пройдёт"
              name="place"
              maxLength={PLACE_LIMIT}
              value={form.place}
              onChange={change}
            />

            <div className="field">
              <label className="visually-hidden" htmlFor={noteFieldId}>
                Комментарий
              </label>
              <div className="field__box">
                <textarea
                  id={noteFieldId}
                  className="field__input new-event__note"
                  name="note"
                  rows={3}
                  maxLength={NOTE_LIMIT}
                  placeholder="Комментарий — что будет, что взять с собой"
                  value={form.note}
                  onChange={change}
                />
              </div>
            </div>

            <fieldset className="new-event__block new-event__audience">
              <legend className="new-event__label">Кто увидит</legend>
              {AUDIENCES.map(({ value, title, note }) => (
                <label className="new-event__option" key={value}>
                  <input
                    type="radio"
                    name="audience"
                    value={value}
                    checked={audience === value}
                    onChange={() => setAudience(value)}
                  />
                  <span className="new-event__option-title">{title}</span>
                  <span className="new-event__option-note">{note}</span>
                </label>
              ))}
            </fieldset>

            {errors.form && (
              <p className="field__error" role="alert">
                {errors.form}
              </p>
            )}

            <button
              className="modal__button modal__button--primary new-event__submit"
              type="submit"
              disabled={sending || !club}
            >
              {sending ? 'Публикуем…' : 'Опубликовать'}
            </button>
          </form>

          <aside className="new-event__preview" aria-label="Так событие увидят на афише">
            <span className="new-event__label">Так увидят</span>
            <EventCard
              event={{
                ...form,
                audience,
                photo,
                club: clubs?.find((item) => item.id === club),
              }}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
