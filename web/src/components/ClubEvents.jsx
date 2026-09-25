import { useCallback, useEffect, useRef, useState } from 'react';
import { IoAdd, IoClose, IoLocationOutline, IoTrashOutline } from 'react-icons/io5';
import { api } from '../api.js';
import { eventDay, eventMonth, eventTime } from '../events.js';
import './ClubEvents.css';

/**
 * События клуба: ближайшие сверху, прошедшие тоже видны — по ним вспоминают,
 * что уже было. Добавляют их здесь же: событие принадлежит клубу, и заводить
 * его логично там, где на клуб и смотрят.
 */
export default function ClubEvents({ clubId, canManage }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', startsAt: '', place: '' });
  const titleRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { events } = await api.clubEvents(clubId);
      setEvents(events);
      setError('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleAdding() {
    setError('');
    setAdding((was) => {
      if (!was) setTimeout(() => titleRef.current?.focus(), 0);
      return !was;
    });
  }

  async function submit(event) {
    event.preventDefault();

    setBusy(true);
    try {
      await api.createClubEvent(clubId, {
        title: draft.title.trim(),
        place: draft.place.trim() || null,
        startsAt: draft.startsAt,
      });
      setDraft({ title: '', startsAt: '', place: '' });
      setAdding(false);
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    try {
      await api.deleteClubEvent(clubId, id);
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="events-body">
        {error && (
          <p className="events-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="events-empty">Загружаем…</p>
        ) : events.length === 0 ? (
          <p className="events-empty">Событий пока нет</p>
        ) : (
          <ul className="events-list">
            {events.map((item) => {
              const at = new Date(item.startsAt);

              return (
                <li className="club-event" key={item.id}>
                  <span className="club-event__date">
                    <span className="club-event__day">{eventDay.format(at)}</span>
                    <span className="club-event__month">{eventMonth.format(at)}</span>
                  </span>

                  <span className="club-event__body">
                    <span className="club-event__title">{item.title}</span>
                    <span className="club-event__meta">
                      {eventTime.format(at)}
                      {item.place && (
                        <>
                          <IoLocationOutline aria-hidden="true" />
                          {item.place}
                        </>
                      )}
                    </span>
                  </span>

                  {canManage && (
                    <button
                      className="club-event__remove"
                      type="button"
                      disabled={busy}
                      aria-label={`Удалить событие: ${item.title}`}
                      onClick={() => remove(item.id)}
                    >
                      <IoTrashOutline aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canManage && (
        <>
          {/* Форма приезжает из кнопки, а не появляется рядом с ней */}
          <div className={`reveal-y${adding ? ' reveal-y--open' : ''}`}>
            <div className="reveal-y__clip">
              <form className="events-form" onSubmit={submit}>
                <label className="visually-hidden" htmlFor="event-title">
                  Название события
                </label>
                <input
                  id="event-title"
                  ref={titleRef}
                  className="events-form__input"
                  placeholder="Название"
                  value={draft.title}
                  tabIndex={adding ? undefined : -1}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />

                <label className="visually-hidden" htmlFor="event-time">
                  Дата и время
                </label>
                <input
                  id="event-time"
                  className="events-form__input events-form__input--time"
                  type="datetime-local"
                  value={draft.startsAt}
                  tabIndex={adding ? undefined : -1}
                  onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                />

                <label className="visually-hidden" htmlFor="event-place">
                  Место
                </label>
                <input
                  id="event-place"
                  className="events-form__input"
                  placeholder="Место"
                  value={draft.place}
                  tabIndex={adding ? undefined : -1}
                  onChange={(e) => setDraft({ ...draft, place: e.target.value })}
                />

                <button className="events-form__submit" type="submit" disabled={busy}>
                  {busy ? 'Сохраняем…' : 'Добавить'}
                </button>
              </form>
            </div>
          </div>

          <button className="side-add" type="button" onClick={toggleAdding}>
            {adding ? (
              <>
                <IoClose aria-hidden="true" />
                Отмена
              </>
            ) : (
              <>
                <IoAdd aria-hidden="true" />
                Добавить событие
              </>
            )}
          </button>
        </>
      )}
    </>
  );
}
