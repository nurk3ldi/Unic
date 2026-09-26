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
import { shortName } from '../people.js';
import InviteDialog from './InviteDialog.jsx';
import Person from './Person.jsx';
import SearchField from './SearchField.jsx';
import './MembersPanel.css';

// Разделы панели. Управляющему видны все три, остальным — только состав
const TABS = [
  { key: 'members', label: 'Участники', empty: 'Пока никого нет' },
  { key: 'invites', label: 'Приглашены', empty: 'Приглашений нет' },
  { key: 'requests', label: 'Заявки', empty: 'Заявок нет' },
];

// Сколько места нужно меню под кнопкой (два пункта по 44px и поля).
// Меньше — оно раскрывается вверх, иначе нижний край списка его обрежет
const MENU_ROOM_REM = 7.5;
// Столько длится уход меню (row-menu-out в index.css)
const MENU_OUT_MS = 150;

/**
 * Управление участниками клуба. Панель сама ходит в API: состав — её предмет,
 * и странице клуба нечего держать у себя список, который меняет только она.
 * Наружу отдаёт лишь число участников — им подписана карточка клуба.
 *
 * Все участники — одним списком одинаковых строк: руководитель не выделен
 * заливкой, только подписан «Лидер» рядом с именем (сервер ставит его первым).
 * Замена руководителя делается на строке нужного участника
 * («Сделать руководителем») — сервер снимает прежнего в той же транзакции.
 */
export default function MembersPanel({ clubId, onCountChange }) {
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [invites, setInvites] = useState([]);
  const [canManage, setCanManage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [tab, setTab] = useState('members');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null); // id участника
  // Меню, которое уходит: держим его ещё на время анимации ухода
  const [leavingMenu, setLeavingMenu] = useState(null);
  const shownMenu = useRef(null);
  const [menuUp, setMenuUp] = useState(false);

  // Окно приглашения; счётчик сеансов — чтобы форма открывалась чистой
  const [inviting, setInviting] = useState(false);
  const [inviteSession, setInviteSession] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await api.clubMembers(clubId);
      setMembers(data.members);
      setRequests(data.requests);
      setInvites(data.invites ?? []);
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

  function openSearch() {
    setSearching(true);
    // Поле раскрывается — фокус сразу в нём, искать можно не целясь
    setTimeout(() => searchRef.current?.querySelector('input')?.focus(), 0);
  }

  function closeSearch() {
    setSearch('');
    setSearching(false);
  }

  function openInvite() {
    setInviteSession((was) => was + 1);
    setInviting(true);
  }

  const lists = { members, invites, requests };
  const current = TABS.find((item) => item.key === tab);
  const list = lists[tab];

  // Поиск — по открытому разделу, и по имени, и по нику («@» в запросе не мешает)
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list;
    const nick = query.replace(/^@/, '');
    return list.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        (nick && member.username?.toLowerCase().includes(nick)),
    );
  }, [list, search]);

  function openTab(key) {
    setOpenMenu(null);
    setTab(key);
  }

  // Закрытое меню не пропадает, а уходит тем же путём, что пришло
  useEffect(() => {
    const was = shownMenu.current;
    shownMenu.current = openMenu;
    if (was === null || was === openMenu) return undefined;
    setLeavingMenu(was);
    const timer = setTimeout(() => setLeavingMenu(null), MENU_OUT_MS);
    return () => clearTimeout(timer);
  }, [openMenu]);

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

    // Меню ложится поверх списка, а список прокручивается и режет всё, что ниже его края
    const list = event.currentTarget.closest('.side-body');
    if (list) {
      const box = list.getBoundingClientRect();
      const button = event.currentTarget.getBoundingClientRect();
      const below = box.bottom - button.bottom;
      const above = button.top - box.top;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      // Вверх — только если снизу тесно, а сверху просторнее
      setMenuUp(below < MENU_ROOM_REM * rem && above > below);
    }
    setOpenMenu((current) => (current === key ? null : key));
  };

  return (
    <>
      {/* Одна строка: разделы с числами (у управляющего) или «Участники · N» —
          и лупа. Заголовок не повторяет вкладку: число живёт в самом разделе.
          Поле поиска раскрывается поверх строки, от лупы к левому краю */}
      <div className={`members-head${searching ? ' members-head--searching' : ''}`}>
        {canManage ? (
          // Сегменты, как в iOS: одна подложка, выбранный — белая плашка, которая
          // переезжает к нажатому. Заявки ждут решения — их число горит красным
          <div className="segments" role="tablist" aria-label="Разделы" inert={searching || undefined}>
            <span
              className="segments__thumb"
              style={{ '--index': TABS.findIndex((item) => item.key === tab) }}
              aria-hidden="true"
            />
            {TABS.map((item) => {
              const count = lists[item.key].length;
              const urgent = item.key === 'requests' && count > 0;
              return (
                <button
                  className="segments__item"
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => openTab(item.key)}
                >
                  {item.label}
                  <span className={urgent ? 'segments__badge' : 'segments__count'}>{count}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <h3 className="members-title" inert={searching || undefined}>
            Участники · {members.length}
          </h3>
        )}

        {/* Лупа едет влево вместе с краем поля и растворяется в лупе самого поля —
            двух значков рядом не бывает. Закрывается как в iOS: Esc или уход
            с пустого поля (кнопки, чтобы закрыть, уже нет — она стала полем) */}
        <div
          className={`members-find${searching ? ' members-find--open' : ''}`}
          ref={searchRef}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            closeSearch();
            searchRef.current?.querySelector('.search-toggle')?.focus();
          }}
          onBlur={(event) => {
            if (!search && !event.currentTarget.contains(event.relatedTarget)) closeSearch();
          }}
        >
          {/* inert: свёрнутое поле не должно ловить Tab */}
          <div className="members-find__field" inert={!searching}>
            <SearchField
              label="Поиск по имени или нику"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          <button
            className="search-toggle"
            type="button"
            aria-label="Найти участника"
            aria-expanded={searching}
            tabIndex={searching ? -1 : undefined}
            onClick={openSearch}
          >
            <IoSearchOutline aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="side-body" role="tabpanel">
        {error && (
          <p className="side-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="side-empty">Загружаем…</p>
        ) : visible.length === 0 ? (
          <p className="side-empty">{search ? 'Никого не нашли' : current.empty}</p>
        ) : (
          // Ключ — раздел: сменили вкладку — список приходит заново, растворением
          <ul className="members" key={tab}>
            {visible.map((person) =>
              tab === 'requests' ? (
                      <li className="member" key={person.id}>
                        <Person person={person} />

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
              ) : tab === 'invites' ? (
                // Кого позвали, но кто ещё не ответил. Передумали — приглашение отзывают
                      <li className="member" key={person.id}>
                        <Person person={person} />
                        <button
                          className="icon-button icon-button--no"
                          type="button"
                          disabled={busy}
                          aria-label={`Отозвать приглашение: ${shortName(person.name)}`}
                          onClick={() => run(() => api.removeClubMember(clubId, person.id))}
                        >
                          <IoClose aria-hidden="true" />
                        </button>
                      </li>
              ) : (
                      // Управляющему строка целиком открывает меню — как «···», только
                      // целиться не нужно. Остальным строка — просто сведения, без подсветки
                      <li
                        className={`member${canManage ? ' member--tap' : ''}`}
                        key={person.id}
                        onClick={canManage ? toggleMenu(person.id) : undefined}
                      >
                        <Person person={person} lead={person.role === 'lead'} />

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

                        {/* Меню ложится поверх списка, из-под кнопки; у нижнего края — вверх.
                            Оно же и подтверждение: до красного пункта нужно дойти вторым касанием */}
                        {(openMenu === person.id || leavingMenu === person.id) && (
                          <div
                            className={`row-menu${menuUp ? ' row-menu--above' : ''}${
                              openMenu === person.id ? '' : ' row-menu--leaving'
                            }`}
                            role="menu"
                            // Нажатие внутри меню — не нажатие по строке
                            onClick={(event) => event.stopPropagation()}
                          >
                            {person.role === 'lead' ? (
                              <button
                                className="row-menu__item"
                                type="button"
                                role="menuitem"
                                onClick={() =>
                                  run(() => api.updateClubMember(clubId, person.id, { role: 'member' }))
                                }
                              >
                                <IoRemoveCircleOutline aria-hidden="true" />
                                Снять с должности
                              </button>
                            ) : (
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
                            )}
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
              ),
            )}
          </ul>
        )}
      </div>

      {canManage && (
        <>
          <button className="side-add" type="button" onClick={openInvite}>
            <IoAdd aria-hidden="true" />
            Пригласить участника
          </button>

          <InviteDialog
            clubId={clubId}
            open={inviting}
            session={inviteSession}
            onClose={() => setInviting(false)}
            onInvited={(status) => {
              setInviting(false);
              // Показываем, куда человек попал: в приглашённые или — если сам
              // просился — сразу в состав
              openTab(status === 'active' ? 'members' : 'invites');
              load();
            }}
          />
        </>
      )}
    </>
  );
}

