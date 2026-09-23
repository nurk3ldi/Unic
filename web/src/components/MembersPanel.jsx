import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoAdd,
  IoCheckmark,
  IoClose,
  IoEllipsisHorizontal,
  IoPersonRemoveOutline,
  IoRemoveCircleOutline,
  IoSearchOutline,
  IoSwapHorizontalOutline,
} from 'react-icons/io5';
import { api } from '../api.js';
import './MembersPanel.css';

/** «Нурланова Айгерим Ержанқызы» → «Айгерим Н.» */
function shortName(fullName) {
  const [last, first] = fullName.trim().split(/\s+/);
  return first ? `${first} ${last[0]}.` : last;
}

const initial = (fullName) => fullName.trim()[0].toUpperCase();

/**
 * Управление участниками клуба. Панель сама ходит в API: состав — её предмет,
 * и странице клуба нечего держать у себя список, который меняет только она.
 * Наружу отдаёт лишь число участников — им подписана карточка клуба.
 *
 * Руководитель вынесен наверх отдельным блоком и не прокручивается.
 * Замена руководителя делается на строке нужного участника
 * («Сделать руководителем») — сервер снимает прежнего в той же транзакции.
 */
export default function MembersPanel({ clubId, onCountChange }) {
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [canManage, setCanManage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState(null); // id участника либо 'lead'

  const [adding, setAdding] = useState(false);
  const [login, setLogin] = useState('');
  const [addError, setAddError] = useState('');
  const addRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.clubMembers(clubId);
      setMembers(data.members);
      setRequests(data.requests);
      setCanManage(data.canManage);
      onCountChange?.(data.members.length);
      setError('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [clubId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  /** Любое действие: выполнить и перечитать состав — он и есть источник правды. */
  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      setOpenMenu(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitAdd(event) {
    event.preventDefault();

    const value = login.trim();
    if (!value) {
      setAddError('Укажите никнейм или почту');
      return;
    }

    setBusy(true);
    try {
      await api.addClubMember(clubId, { username: value });
      setLogin('');
      setAddError('');
      setAdding(false);
      await load();
    } catch (failure) {
      setAddError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleAdding() {
    setAddError('');
    setAdding((was) => {
      if (!was) setTimeout(() => addRef.current?.focus(), 0);
      return !was;
    });
  }

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

            {canManage && (
              <button
                className="icon-button icon-button--accent"
                type="button"
                disabled={busy}
                aria-expanded={openMenu === 'lead'}
                aria-label={`Действия: ${shortName(lead.name)}`}
                onClick={toggleMenu('lead')}
              >
                <IoEllipsisHorizontal aria-hidden="true" />
              </button>
            )}
          </div>

          {openMenu === 'lead' && (
            <div className="row-menu" role="menu">
              <button
                className="row-menu__item"
                type="button"
                role="menuitem"
                onClick={() => run(() => api.updateClubMember(clubId, lead.id, { role: 'member' }))}
              >
                <IoRemoveCircleOutline aria-hidden="true" />
                Снять с должности
              </button>
              <button
                className="row-menu__item row-menu__item--danger"
                type="button"
                role="menuitem"
                onClick={() => run(() => api.removeClubMember(clubId, lead.id))}
              >
                <IoPersonRemoveOutline aria-hidden="true" />
                Исключить из клуба
              </button>
            </div>
          )}
        </div>
      )}

      <div className="side-body">
        {error && (
          <p className="side-error" role="alert">
            {error}
          </p>
        )}

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
                    disabled={busy}
                    aria-label={`Одобрить заявку: ${shortName(person.name)}`}
                    onClick={() =>
                      run(() => api.updateClubMember(clubId, person.id, { status: 'active' }))
                    }
                  >
                    <IoCheckmark aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button icon-button--no"
                    type="button"
                    disabled={busy}
                    aria-label={`Отклонить заявку: ${shortName(person.name)}`}
                    onClick={() => run(() => api.removeClubMember(clubId, person.id))}
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

          {loading ? (
            <p className="side-empty">Загружаем…</p>
          ) : visible.length === 0 ? (
            <p className="side-empty">{search ? 'Никого не нашли' : 'Пока никого нет'}</p>
          ) : (
            <ul className="members">
              {visible.map((person) => (
                <li className="member" key={person.id}>
                  <span className="member__avatar" aria-hidden="true">
                    {initial(person.name)}
                  </span>
                  <span className="member__name">{shortName(person.name)}</span>

                  {canManage && (
                    <button
                      className="icon-button"
                      type="button"
                      disabled={busy}
                      aria-expanded={openMenu === person.id}
                      aria-label={`Действия: ${shortName(person.name)}`}
                      onClick={toggleMenu(person.id)}
                    >
                      <IoEllipsisHorizontal aria-hidden="true" />
                    </button>
                  )}

                  {/* Меню раскрывается в строке: панель прокручивается, выпадающее обрезалось бы.
                      Оно же и подтверждение: до красного пункта нужно дойти вторым касанием */}
                  {openMenu === person.id && (
                    <div className="row-menu row-menu--inline" role="menu">
                      <button
                        className="row-menu__item"
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          run(() => api.updateClubMember(clubId, person.id, { role: 'lead' }))
                        }
                      >
                        <IoSwapHorizontalOutline aria-hidden="true" />
                        Сделать руководителем
                      </button>
                      <button
                        className="row-menu__item row-menu__item--danger"
                        type="button"
                        role="menuitem"
                        onClick={() => run(() => api.removeClubMember(clubId, person.id))}
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

      {canManage && (
        <>
          {/* Поле приезжает из кнопки, а не появляется рядом с ней */}
          <div className={`reveal-y${adding ? ' reveal-y--open' : ''}`}>
            <div className="reveal-y__clip">
              <form className="side-add-form" onSubmit={submitAdd}>
                <label className="visually-hidden" htmlFor="member-login">
                  Никнейм или почта
                </label>
                <span className="side-search__field">
                  <input
                    id="member-login"
                    ref={addRef}
                    className="side-search__input"
                    placeholder="Никнейм или почта"
                    value={login}
                    tabIndex={adding ? undefined : -1}
                    onChange={(event) => {
                      setLogin(event.target.value);
                      setAddError('');
                    }}
                  />
                </span>

                <button className="side-add-form__submit" type="submit" disabled={busy}>
                  {busy ? 'Добавляем…' : 'Добавить'}
                </button>

                {addError && (
                  <p className="side-error" role="alert">
                    {addError}
                  </p>
                )}
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
                Добавить участника
              </>
            )}
          </button>
        </>
      )}
    </>
  );
}
