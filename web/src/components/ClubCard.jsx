import './ClubCard.css';

/** Карточка клуба: в шапке — название, тело заполним на следующем шаге. */
export default function ClubCard({ name }) {
  return (
    <article className="club">
      <div className="club__header">
        <h2 className="club__name">{name}</h2>
      </div>

      <div className="club__body" />
    </article>
  );
}
