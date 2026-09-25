import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IoLocationOutline, IoTimeOutline } from 'react-icons/io5';
import { api } from '../api.js';
import { eventDay, eventMonth, eventTime } from '../events.js';
import './Page.css';
import './Events.css';

/**
 * Ближайшие события клубов, в которых человек состоит (университет и админ
 * видят все). Прошедшие не показываем: сюда приходят с вопросом «что будет».
 *
 * Создают события на странице клуба — там понятно, чьё это событие.
 */
export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .events()
      .then(({ events }) => setEvents(events))
      .catch((failure) => setError(failure.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page">
      <div className="events">
        <div className="card-header">
          <h1 className="card-header__title">События</h1>
        </div>

        {loading ? (
          <p className="events__empty">Загружаем…</p>
        ) : error ? (
          <p className="events__empty" role="alert">
            {error}
          </p>
        ) : events.length === 0 ? (
          <p className="events__empty">Ближайших событий нет</p>
        ) : (
          <ul className="events__list">
            {events.map((event) => {
              const at = new Date(event.startsAt);

              return (
                <li key={event.id}>
                  <Link className="event" to={`/clubs/${event.club.id}`} viewTransition>
                    {/* Дата слева плашкой: по ней список читают глазами */}
                    <span className="event__date">
                      <span className="event__day">{eventDay.format(at)}</span>
                      <span className="event__month">{eventMonth.format(at)}</span>
                    </span>

                    <span className="event__body">
                      <span className="event__title">{event.title}</span>

                      <span className="event__meta">
                        <IoTimeOutline aria-hidden="true" />
                        {eventTime.format(at)}
                        {event.place && (
                          <>
                            <IoLocationOutline aria-hidden="true" />
                            {event.place}
                          </>
                        )}
                      </span>
                    </span>

                    <span className="event__club">{event.club.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
