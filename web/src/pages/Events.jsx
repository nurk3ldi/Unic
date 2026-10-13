import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconFilter,
  IconGrid,
  IconPlus,
} from '../icons.jsx';
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

/**
 * «События»: страница собирается заново. Пока готова верхняя полоса —
 * вкладки, поиск, фильтры, вид и добавление события; сама афиша встанет под ней
 * следующим шагом.
 */
export default function Events() {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [club, setClub] = useState(ALL_CLUBS.value);
  const [period, setPeriod] = useState('all');
  const [view, setView] = useState('cards');
  // Есть ли клуб, которому этот человек может добавить событие; нет — нет и «+»
  const [canAdd, setCanAdd] = useState(false);

  useEffect(() => {
    api
      .events(EVERYTHING)
      .then(({ events }) => setEvents(events))
      .catch(() => {}); // без событий полоса остаётся рабочей — счётчики просто нули
    api
      .eventTargets()
      .then(({ clubs }) => setCanAdd(clubs.length > 0))
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const result = { upcoming: 0, today: 0, past: 0 };
    for (const event of events) {
      const starts = new Date(event.startsAt);
      result[starts >= now ? 'upcoming' : 'past'] += 1;
      if (starts.toDateString() === today) result.today += 1;
    }
    return result;
  }, [events]);

  // В фильтре — только клубы, у которых события есть: остальные дали бы пустоту
  const clubs = useMemo(() => {
    const names = new Map(events.map((event) => [event.club.id, event.club.name]));
    const options = [...names].map(([value, label]) => ({ value, label }));
    return [ALL_CLUBS, ...options.sort((a, b) => a.label.localeCompare(b.label, 'ru'))];
  }, [events]);

  return (
    <main className="page">
      <h1 className="visually-hidden">События</h1>

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
