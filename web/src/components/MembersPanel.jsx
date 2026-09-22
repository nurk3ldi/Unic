import { useEffect, useMemo, useState } from 'react';
import {
  IoAdd,
  IoCheckmark,
  IoClose,
  IoEllipsisHorizontal,
  IoSearchOutline,
  IoSwapHorizontalOutline,
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
  const [leadMenu, setLeadMenu] = useState(false);

  const lead = members.find((member) => member.role === 'lead') ?? null;

  // Руководитель вынесен отдельным блоком, поэтому в списке его нет
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rest = members.filter((member) => member.role !== 'lead');
    return query ? rest.filter((member) => member.name.toLowerCase().includes(query)) : rest;
  }, [members, search]);

  // Меню закрывается кликом вне и клавишей Esc
  useEffect(() => {
    if (!leadMenu) return undefined;

    const close = () => setLeadMenu(false);
    const onKey = (event) => event.key === 'Escape' && close();

    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [leadMenu]);

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

      {lead && (
        <div className="lead-block">
          <h3 className="side-section__title">Руководитель</h3>

          <div className="lead">
            <span className="lead__avatar" aria-hidden="true">
              {initial(lead.name)}
            </span>
            <span className="lead__name">{shortName(lead.name)}</span>

            <button
              className="lead__more"
              type="button"
              aria-expanded={leadMenu}
              title="Действия"
              onClick={(event) => {
                event.stopPropagation(); // иначе тот же клик сразу закроет меню
                setLeadMenu((open) => !open);
              }}
            >
              <IoEllipsisHorizontal aria-hidden="true" />
            </button>

            {leadMenu && (
              <div className="lead__menu" role="menu">
                <button className="lead__menu-item" type="button" role="menuitem">
                  <IoSwapHorizontalOutline aria-hidden="true" />
                  Изменить руководителя
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
          <h3 className="side-section__title">Участники · {visible.length}</h3>

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

                  <button className="member__more" type="button" title="Действия">
                    <IoEllipsisHorizontal aria-hidden="true" />
                  </button>
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
