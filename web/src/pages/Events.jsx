import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconGrid,
  IconPlus,
} from '../icons.jsx';
import EventCard from '../components/EventCard.jsx';
import SearchField from '../components/SearchField.jsx';
import './Page.css';
import './Events.css';

/** Вкладки делят афишу по времени — одна ось, и она понятна любой роли. */
const TABS = [
  { id: 'upcoming', label: 'Предстоящие' },
  { id: 'today', label: 'Сегодня' },
  { id: 'past', label: 'Прошедшие' },
];

const PERIODS = [
  { value: 'all', label: 'Все даты' },
  { value: 'week', label: 'Эта неделя' },
  { value: 'month', label: 'Этот месяц' },
  { value: 'next', label: 'Следующий месяц' },
];

const VIEWS = [
  { id: 'cards', label: 'Карточки', Icon: IconGrid },
  { id: 'calendar', label: 'Календарь', Icon: IconCalendar },
];

// Счётчикам вкладок нужны все события разом, а у сервера «без дат» значит
// «только будущие» — поэтому промежуток заведомо шире любой афиши
const EVERYTHING = { from: '2000-01-01', to: '2100-01-01' };

const ALL_CLUBS = { value: 'all', label: 'Все клубы' };

// Сколько карточек на странице афиши: восемь — два ряда по четыре
const PAGE_SIZES = [8, 16, 32];

// Что сказать, когда во вкладке пусто
const EMPTY = {
  upcoming: 'Предстоящих событий нет',
  today: 'Сегодня событий нет',
  past: 'Прошедших событий нет',
};

/** Промежуток фильтра «Период»: [с, по) — или null, если подходят все даты. */
function periodRange(period, now) {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (period === 'month') return [new Date(year, month, 1), new Date(year, month + 1, 1)];
  if (period === 'next') return [new Date(year, month + 1, 1), new Date(year, month + 2, 1)];
  if (period === 'week') {
    // Неделя — с понедельника
    const monday = now.getDate() - ((now.getDay() + 6) % 7);
    return [new Date(year, month, monday), new Date(year, month, monday + 7)];
  }
  return null;
}

/** Номера страниц для кнопок: все, пока их немного, иначе — края, соседи и «…». */
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const near = [current - 1, current, current + 1].filter((page) => page > 1 && page < total);
  if (current <= 3) near.unshift(...[2, 3].filter((page) => !near.includes(page)));
  if (current >= total - 2) near.push(...[total - 2, total - 1].filter((page) => !near.includes(page)));
  const pages = [1, ...near.sort((a, b) => a - b), total];
  // Разрыв в номерах — многоточие
  return pages.flatMap((page, index) => (index && page - pages[index - 1] > 1 ? ['…', page] : [page]));
}

/**
 * «События»: афиша карточками, всё в одной общей карточке. Сверху полоса —
 * вкладки по времени, поиск, фильтры, вид и добавление события; под ней сетка,
 * внизу страницы.
 */
export default function Events() {
  const [events, setEvents] = useState(null); // null — ещё не загружены
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [club, setClub] = useState(ALL_CLUBS.value);
  const [period, setPeriod] = useState('all');
  const [view, setView] = useState('cards');
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  // Есть ли клуб, которому этот человек может добавить событие; нет — нет и «+»
  const [canAdd, setCanAdd] = useState(false);

  useEffect(() => {
    api
      .events(EVERYTHING)
      .then(({ events }) => setEvents(events))
      .catch(() => setEvents([])); // без событий полоса остаётся рабочей — счётчики просто нули
    api
      .eventTargets()
      .then(({ clubs }) => setCanAdd(clubs.length > 0))
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const result = { upcoming: 0, today: 0, past: 0 };
    for (const event of events ?? []) {
      const starts = new Date(event.startsAt);
      result[starts >= now ? 'upcoming' : 'past'] += 1;
      if (starts.toDateString() === today) result.today += 1;
    }
    return result;
  }, [events]);

  // В фильтре — только клубы, у которых события есть: остальные дали бы пустоту
  const clubs = useMemo(() => {
    const names = new Map((events ?? []).map((event) => [event.club.id, event.club.name]));
    const options = [...names].map(([value, label]) => ({ value, label }));
    return [ALL_CLUBS, ...options.sort((a, b) => a.label.localeCompare(b.label, 'ru'))];
  }, [events]);

  // Что показывать: вкладка, клуб, период и поиск — всё разом
  const shown = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const range = periodRange(period, now);
    const text = search.trim().toLowerCase();

    const list = (events ?? []).filter((event) => {
      const starts = new Date(event.startsAt);
      if (tab === 'upcoming' && starts < now) return false;
      if (tab === 'past' && starts >= now) return false;
      if (tab === 'today' && starts.toDateString() !== today) return false;
      if (club !== ALL_CLUBS.value && event.club.id !== club) return false;
      if (range && (starts < range[0] || starts >= range[1])) return false;
      return (
        !text ||
        [event.title, event.place, event.club.name].some((value) => value?.toLowerCase().includes(text))
      );
    });
    // Сервер отдаёт от ранних к поздним; прошедшие читают наоборот — с недавних
    return tab === 'past' ? list.reverse() : list;
  }, [events, tab, club, period, search]);

  // Другой набор событий — снова с первой страницы
  useEffect(() => setPage(1), [tab, club, period, search, size]);

  const pages = Math.max(1, Math.ceil(shown.length / size));
  const current = Math.min(page, pages); // событий могло стать меньше
  const filtered = search.trim() || club !== ALL_CLUBS.value || period !== 'all';

  function turn(next) {
    setPage(next);
    window.scrollTo(0, 0); // новая страница читается сверху
  }

  return (
    <main className="page">
      <h1 className="visually-hidden">События</h1>

      {/* Полоса, афиша и страницы — одна общая карточка */}
      <section className="events-panel" aria-label="Афиша">
      <div className="events-bar">
        <div className="events-tabs" role="tablist" aria-label="Какие события показать">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              className="events-tab"
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
              <span className="events-tab__count">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="events-tools">
          <SearchField
            label="Поиск события или места"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch('')}
          />

          <Dropdown
            label="Клуб"
            Icon={IconFilter}
            options={clubs}
            value={club}
            onChange={setClub}
          />
          <Dropdown label="Период" options={PERIODS} value={period} onChange={setPeriod} />

          <div className="events-views" role="group" aria-label="Вид">
            {VIEWS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className="events-view"
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                <Icon aria-hidden="true" />
              </button>
            ))}
          </div>

          {canAdd && (
            <Link
              className="events-add"
              to="/create/event"
              viewTransition
              aria-label="Добавить событие"
              title="Добавить событие"
            >
              <IconPlus aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {events && (
        <div className="events-body">
          {view === 'calendar' ? (
            <p className="events-empty">Календарь скоро появится</p>
          ) : shown.length === 0 ? (
            <p className="events-empty">{filtered ? 'Ничего не нашли' : EMPTY[tab]}</p>
          ) : (
            <>
              <div className="events-grid">
                {shown.slice((current - 1) * size, current * size).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>

              <div className="events-foot">
                <label className="events-size">
                  Показывать по
                  <span className="events-size__box">
                    <select value={size} onChange={(event) => setSize(Number(event.target.value))}>
                      {PAGE_SIZES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <IconChevronDown aria-hidden="true" />
                  </span>
                  из {shown.length}
                </label>

                {pages > 1 && (
                  <nav className="events-pages" aria-label="Страницы афиши">
                    <button
                      className="events-page"
                      type="button"
                      aria-label="Предыдущая страница"
                      disabled={current === 1}
                      onClick={() => turn(current - 1)}
                    >
                      <IconChevronLeft aria-hidden="true" />
                    </button>
                    {pageNumbers(current, pages).map((number, index) =>
                      number === '…' ? (
                        <span className="events-page events-page--gap" key={`gap-${index}`}>
                          …
                        </span>
                      ) : (
                        <button
                          key={number}
                          className="events-page"
                          type="button"
                          aria-label={`Страница ${number}`}
                          aria-current={number === current ? 'page' : undefined}
                          onClick={() => turn(number)}
                        >
                          {number}
                        </button>
                      ),
                    )}
                    <button
                      className="events-page"
                      type="button"
                      aria-label="Следующая страница"
                      disabled={current === pages}
                      onClick={() => turn(current + 1)}
                    >
                      <IconChevronRight aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </div>
            </>
          )}
        </div>
      )}
      </section>
    </main>
  );
}

/**
 * Выпадающий список: кнопка показывает выбранное, меню открывает сам браузер
 * (popover) — закрытие по Esc и по щелчку мимо достаются даром, а верхний слой
 * не даёт странице его обрезать. Здесь — только куда его поставить.
 */
function Dropdown({ label, Icon, options, value, onChange }) {
  const id = useId();
  const menuRef = useRef(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  /** Меню встаёт под кнопкой, правым краем к её правому краю — растёт из неё. */
  function aim(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const menu = menuRef.current;
    menu.style.top = `${rect.bottom + 8}px`;
    // clientWidth, а не innerWidth: полоса прокрутки в область меню не входит
    menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
  }

  function pick(next) {
    menuRef.current.hidePopover();
    onChange(next);
  }

  return (
    <>
      <button
        className="events-select"
        type="button"
        aria-label={`${label}: ${current.label}`}
        aria-haspopup="menu"
        popoverTarget={id}
        onClick={aim}
      >
        {Icon && <Icon aria-hidden="true" />}
        <span className="events-select__label">{current.label}</span>
        <IconChevronDown className="events-select__chevron" aria-hidden="true" />
      </button>

      <div
        ref={menuRef}
        id={id}
        className="row-menu events-menu"
        popover="auto"
        role="menu"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            className="row-menu__item"
            type="button"
            role="menuitemradio"
            aria-checked={option.value === value}
            onClick={() => pick(option.value)}
          >
            <span className="events-menu__label">{option.label}</span>
            {option.value === value && <IconCheck className="events-menu__check" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </>
  );
}
