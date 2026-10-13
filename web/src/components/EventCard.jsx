import { IconCalendar, IconLocation } from '../icons.jsx';
import { eventDate, eventTime } from '../events.js';
import './EventCard.css';

/** Кому видно событие — подпись на обложке. */
export const AUDIENCE_LABELS = { all: 'Для всех', club: 'Только клуб' };

/**
 * Карточка события на афише: обложка с клубом и видимостью, под ней — когда,
 * что и где. Её же показывает страница создания как «так увидят», поэтому
 * названия и даты может ещё не быть — тогда на их месте тихая подпись.
 */
export default function EventCard({ event }) {
  const starts = event.startsAt ? new Date(event.startsAt) : null;
  const when = starts && !Number.isNaN(starts.getTime()) ? starts : null;

  return (
    <article className="event-card">
      <div className="event-card__cover">
        {event.photo ? (
          <img src={event.photo} alt="" />
        ) : (
          <IconCalendar className="event-card__blank-cover" aria-hidden="true" />
        )}

        {event.club?.name && (
          <span className="event-card__chip event-card__chip--host">{event.club.name}</span>
        )}
        <span className="event-card__chip event-card__chip--audience" data-audience={event.audience}>
          {AUDIENCE_LABELS[event.audience]}
        </span>
      </div>

      <p className={`event-card__when${when ? '' : ' event-card__blank'}`}>
        {when ? (
          <>
            {eventDate(when)} <span aria-hidden="true">—</span> {eventTime.format(when)}
          </>
        ) : (
          'Дата и время'
        )}
      </p>

      <h3 className={`event-card__title${event.title ? '' : ' event-card__blank'}`}>
        {event.title || 'Название события'}
      </h3>

      {event.place && (
        <p className="event-card__place">
          <IconLocation aria-hidden="true" />
          <span>{event.place}</span>
        </p>
      )}

      {event.note && <p className="event-card__note">{event.note}</p>}
    </article>
  );
}
