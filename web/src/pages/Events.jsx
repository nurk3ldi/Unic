import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { api } from '../api.js';
import { eventTime } from '../events.js';
import { authorColor, initial } from '../people.js';
import './Page.css';
import './Events.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
// Название месяца в именительном («сентябрь», а не «сентября») — у месяца отдельно
const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
// Сколько событий помещается в клетку; остальные — строкой «ещё N»
const PER_DAY = 3;

const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** Первый день месяца — от него строится сетка. */
const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

/** Сетка — всегда 6 недель с понедельника: высота календаря не прыгает от месяца к месяцу. */
function gridDays(month) {
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7)); // назад до понедельника
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

/**
 * События: слева — клубы, справа — календарь месяца, как в «Календаре» Apple.
 * Во всю ширину, без карточки, как чат (.page--flush).
 */
export default function Events() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .clubs()
      .then(({ clubs }) => alive && setClubs(clubs))
      .catch((failure) => alive && setError(failure.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="page page--flush">
      <div className="events-layout">
        {/* Клубы — узкой полосой снимков; при наведении полоса выезжает поверх
            календаря и показывает названия. Календарь при этом не сдвигается */}
        <section className="events-layout__side" aria-label="Клубы">
          <div className="events-rail" tabIndex={-1}>
            {loading ? (
              <p className="events-clubs__empty">…</p>
            ) : error ? (
              <p className="events-clubs__empty" role="alert">
                {error}
              </p>
            ) : (
              <ul className="events-clubs">
                {clubs.map((club) => (
                  <li className="events-club" key={club.id} title={club.name}>
                    <span className="events-club__photo">
                      {club.photo ? (
                        <img src={club.photo} alt="" />
                      ) : (
                        <span aria-hidden="true">{initial(club.name)}</span>
                      )}
                    </span>
                    <span className="events-club__name">{club.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <Calendar />
      </div>
    </main>
  );
}

/** Месяц сеткой 7×6. События — строками в клетке дня: точка цвета клуба, время, название. */
function Calendar() {
  const today = new Date();
  const [month, setMonth] = useState(() => monthStart(today));
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  const days = useMemo(() => gridDays(month), [month]);

  // Грузим ровно видимые 6 недель — с хвостами соседних месяцев
  useEffect(() => {
    let alive = true;
    const to = new Date(days[41]);
    to.setDate(to.getDate() + 1);
    api
      .events({ from: days[0].toISOString(), to: to.toISOString() })
      .then(({ events }) => {
        if (alive) {
          setEvents(events);
          setError('');
        }
      })
      .catch((failure) => alive && setError(failure.message));
    return () => {
      alive = false;
    };
  }, [days]);

  // События по дням — один проход, а не фильтр в каждой из 42 клеток
  const byDay = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      const key = new Date(event.startsAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const shift = (step) => setMonth((was) => new Date(was.getFullYear(), was.getMonth() + step, 1));
  const title = monthName.format(month);
  const isThisMonth = sameDay(month, monthStart(today));

  return (
    <section className="calendar" aria-label="Календарь событий">
      <div className="calendar__head">
        <h1 className="calendar__title">
          <span className="calendar__month">{title[0].toUpperCase() + title.slice(1)}</span>{' '}
          {month.getFullYear()}
        </h1>

        {error && (
          <p className="calendar__error" role="alert">
            {error}
          </p>
        )}

        <div className="calendar__nav">
          <button
            className="calendar__button"
            type="button"
            aria-label="Предыдущий месяц"
            onClick={() => shift(-1)}
          >
            <IoChevronBack aria-hidden="true" />
          </button>
          <button
            className="calendar__button calendar__button--today"
            type="button"
            disabled={isThisMonth}
            onClick={() => setMonth(monthStart(today))}
          >
            Сегодня
          </button>
          <button
            className="calendar__button"
            type="button"
            aria-label="Следующий месяц"
            onClick={() => shift(1)}
          >
            <IoChevronForward aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>

      <div className="calendar__grid">
        {days.map((day) => {
          const list = byDay.get(day.toDateString()) ?? [];
          const outside = day.getMonth() !== month.getMonth();
          return (
            <div
              className={`calendar__day${outside ? ' calendar__day--outside' : ''}`}
              key={day.toISOString()}
            >
              <span
                className={`calendar__date${sameDay(day, today) ? ' calendar__date--today' : ''}`}
              >
                {day.getDate()}
              </span>

              {list.slice(0, PER_DAY).map((event) => (
                <Link
                  className="calendar__event"
                  to={`/clubs/${event.club.id}`}
                  key={event.id}
                  title={`${event.title} — ${event.club.name}${event.place ? `, ${event.place}` : ''}`}
                  viewTransition
                >
                  {/* Цвет клуба — тот же, каким его имя окрашено в чатах */}
                  <span
                    className="calendar__dot"
                    style={{ background: authorColor(event.club.id) }}
                    aria-hidden="true"
                  />
                  <span className="calendar__time">{eventTime.format(new Date(event.startsAt))}</span>
                  <span className="calendar__name">{event.title}</span>
                </Link>
              ))}

              {list.length > PER_DAY && (
                <span className="calendar__more">ещё {list.length - PER_DAY}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
