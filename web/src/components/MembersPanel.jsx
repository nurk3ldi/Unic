import { useMemo, useState } from 'react';
import {
  IoAdd,
  IoCheckmark,
  IoClose,
  IoEllipsisHorizontal,
  IoSearchOutline,
} from 'react-icons/io5';
import './MembersPanel.css';

/** «Нурланова Айгерим Ержанқызы» → «Айгерим Н.» */
function shortName(fullName) {
  const [last, first] = fullName.trim().split(/\s+/);
  return first ? `${first} ${last[0]}.` : last;
}

const initial = (fullName) => fullName.trim()[0].toUpperCase();

/** Управление участниками клуба. Руководитель всегда первый в списке. */
export default function MembersPanel({ members = [], requests = [] }) {
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const found = query
      ? members.filter((member) => member.name.toLowerCase().includes(query))
      : members;

    // Руководителя держим наверху независимо от порядка данных
    return [...found].sort((a, b) => Number(b.role === 'lead') - Number(a.role === 'lead'));
  }, [members, search]);

  return (
    <>
      <div className="side-search">
        <IoSearchOutline aria-hidden="true" />
        <input
          className="side-search__input"
          type="search"
          placeholder="Поиск"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="side-body">
        {requests.length > 0 && (
          <section className="side-section">
            <h3 className="side-section__title">Заявки · {requests.length}</h3>

            <ul className="members">
              {requests.map((person) => (
                <li className="member" key={person.id}>
                  <span className="member__avatar" aria-hidden="true">
                    {initial(person.name)}
                  </span>
                  <span className="member__name">{shortName(person.name)}</span>

                  {/* Решение по заявке — основная работа роли, прячем в меню нельзя */}
                  <button className="member__act member__act--yes" type="button" title="Одобрить">
                    <IoCheckmark aria-hidden="true" />
                  </button>
                  <button className="member__act member__act--no" type="button" title="Отклонить">
                    <IoClose aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="side-section">
          <h3 className="side-section__title">Участники · {members.length}</h3>

          {visible.length === 0 ? (
            <p className="side-empty">Никого не нашли</p>
          ) : (
            <ul className="members">
              {visible.map((person) => (
                <li className="member" key={person.id}>
                  <span className="member__avatar" aria-hidden="true">
                    {initial(person.name)}
                  </span>
                  <span className="member__name">{shortName(person.name)}</span>

                  {person.role === 'lead' ? (
                    <span className="member__role">Руководитель</span>
                  ) : (
                    <button className="member__more" type="button" title="Действия">
                      <IoEllipsisHorizontal aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <button className="side-add" type="button">
        <IoAdd aria-hidden="true" />
        Добавить участника
      </button>
    </>
  );
}
