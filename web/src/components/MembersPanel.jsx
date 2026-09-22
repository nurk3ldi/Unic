import { useEffect, useMemo, useState } from 'react';
import {
  IoAdd,
  IoCheckmark,
  IoClose,
  IoEllipsisHorizontal,
  IoPersonRemoveOutline,
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

/** Управление участниками клуба. Руководитель вынесен наверх отдельным блоком. */
export default function MembersPanel({ members = [], requests = [] }) {
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState(null); // id участника либо 'lead'

  const lead = members.find((member) => member.role === 'lead') ?? null;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rest = members.filter((member) => member.role !== 'lead');
    return query ? rest.filter((member) => member.name.toLowerCase().includes(query)) : rest;
  }, [members, search]);

  // Меню закрывается кликом вне и клавишей Esc
  useEffect(() => {
    if (openMenu === null) return undefined;

    const close = () => setOpenMenu(null);
    const onKey = (event) => event.key === 'Escape' && close();

    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const toggleMenu = (key) => (event) => {
    event.stopPropagation(); // иначе тот же клик сразу закроет меню
    setOpenMenu((current) => (current === key ? null : key));
  };

  return (
    <>
      <div className="side-search">
        <span className="side-search__field">
          <IoSearchOutline aria-hidden="true" />
          <input
            className="side-search__input"
            type="search"
            placeholder="Поиск"
            aria-label="Поиск участников"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </span>
      </div>

      {lead && (
        <div className="lead-block">
          <h3 className="side-title">Руководитель</h3>

          <div className="lead">
            <span className="lead__avatar" aria-hidden="true">
              {initial(lead.name)}
            </span>
            <span className="lead__name">{shortName(lead.name)}</span>

            <button
              className="icon-button icon-button--accent"
              type="button"
              aria-expanded={openMenu === 'lead'}
              aria-label={`Действия: ${shortName(lead.name)}`}
              onClick={toggleMenu('lead')}
            >
              <IoEllipsisHorizontal aria-hidden="true" />
            </button>
          </div>

          {openMenu === 'lead' && (
            <div className="row-menu" role="menu">
              <button className="row-menu__item" type="button" role="menuitem">
                <IoSwapHorizontalOutline aria-hidden="true" />
                Изменить руководителя
              </button>
            </div>
          )}
        </div>
      )}

      <div className="side-body">
        {requests.length > 0 && (
          <section className="side-section">
            <h3 className="side-title">Заявки · {requests.length}</h3>

            <ul className="members">
              {requests.map((person) => (
                <li className="member" key={person.id}>
                  <span className="member__avatar" aria-hidden="true">
                    {initial(person.name)}
                  </span>
                  <span className="member__name">{shortName(person.name)}</span>

                  {/* Решение по заявке — основная работа роли, в меню не прячем */}
                  <button
                    className="icon-button icon-button--yes"
                    type="button"
                    aria-label={`Одобрить заявку: ${shortName(person.name)}`}
                  >
                    <IoCheckmark aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button icon-button--no"
                    type="button"
                    aria-label={`Отклонить заявку: ${shortName(person.name)}`}
                  >
                    <IoClose aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="side-section">
          <h3 className="side-title">Участники · {visible.length}</h3>

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

                  <button
                    className="icon-button"
                    type="button"
                    aria-expanded={openMenu === person.id}
                    aria-label={`Действия: ${shortName(person.name)}`}
                    onClick={toggleMenu(person.id)}
                  >
                    <IoEllipsisHorizontal aria-hidden="true" />
                  </button>

                  {/* Меню раскрывается в строке: панель прокручивается, выпадающее обрезалось бы */}
                  {openMenu === person.id && (
                    <div className="row-menu row-menu--inline" role="menu">
                      <button className="row-menu__item" type="button" role="menuitem">
                        <IoSwapHorizontalOutline aria-hidden="true" />
                        Сделать руководителем
                      </button>
                      <button
                        className="row-menu__item row-menu__item--danger"
                        type="button"
                        role="menuitem"
                      >
                        <IoPersonRemoveOutline aria-hidden="true" />
                        Исключить из клуба
                      </button>
                    </div>
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
