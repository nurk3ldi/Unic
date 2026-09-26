import { authorColor, initial } from '../people.js';

/**
 * Кто это — как строка в списке чатов WhatsApp: крупный круглый аватар с буквой
 * личного цвета (тем же, каким имя окрашено в чате), сверху полное имя, под ним ник.
 */
export default function Person({ person, lead = false }) {
  return (
    <>
      <span
        className="member__avatar"
        style={{ color: authorColor(person.id) }}
        aria-hidden="true"
      >
        {initial(person.name)}
      </span>
      <span className="member__text">
        <span className="member__top">
          <span className="member__name" title={person.name}>
            {person.name}
          </span>
          {lead && <span className="member__tag">Лидер</span>}
        </span>
        {person.username && <span className="member__nick">@{person.username}</span>}
      </span>
    </>
  );
}
