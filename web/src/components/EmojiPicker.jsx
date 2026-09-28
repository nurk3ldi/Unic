import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  IoAirplaneOutline,
  IoBulbOutline,
  IoFastFoodOutline,
  IoFootballOutline,
  IoHappyOutline,
  IoHeartOutline,
  IoLeafOutline,
} from 'react-icons/io5';
import SearchField from './SearchField.jsx';
import './EmojiPicker.css';

const ICONS = {
  people: IoHappyOutline,
  nature: IoLeafOutline,
  food: IoFastFoodOutline,
  activity: IoFootballOutline,
  travel: IoAirplaneOutline,
  objects: IoBulbOutline,
  symbols: IoHeartOutline,
};

// Размер окна — тот же, что в CSS: по нему окно ставится до того, как его видно
const WIDTH_REM = 22;
const HEIGHT_REM = 24;
// Отступ от краёв экрана
const EDGE_PX = 8;
// Сколько длится уход (как --duration-fast): окно успевает раствориться до размонтирования
const LEAVE_MS = 200;

/**
 * Все эмодзи для реакции. Нативный popover: закрывается кликом мимо и Esc и живёт
 * в верхнем слое — прокручиваемая лента его не обрезает. Встаёт там, где было меню,
 * и растёт из кнопки «+» (§4.3). Сверху поиск, под ним группы, как на клавиатуре
 * Apple: нажатие листает к группе, при прокрутке подсвечивается видимая.
 *
 * **Список подгружается отдельно.** Полторы тысячи знаков с русскими названиями —
 * это 150 КБ, и держать их в общей сборке ради окна, которое открывают изредка,
 * незачем: `import()` кладёт их в свой файл, и он едет только когда окно открыли.
 *
 * `anchor` — прямоугольник кнопки «+», `chosen` — своя реакция (подсвечена;
 * нажать её ещё раз — убрать).
 */
export default function EmojiPicker({ anchor, chosen, onPick, onClose }) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const [groups, setGroups] = useState(null);
  const [active, setActive] = useState(null);
  const [query, setQuery] = useState('');

  const search = query.trim().toLowerCase();

  // Ищем и по названию, и по словам рядом с ним: «сердце» найдёт и 💜, и 💘
  const found = useMemo(() => {
    if (!search || !groups) return null;
    return groups.flatMap((group) =>
      group.list.filter(([, name, words]) => name.includes(search) || words.includes(search)),
    );
  }, [search, groups]);

  // До отрисовки: место и точка роста, сразу показ — окно не мелькает в углу
  useLayoutEffect(() => {
    const box = ref.current;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const width = WIDTH_REM * rem;
    const height = HEIGHT_REM * rem;
    const clamp = (value, max) => Math.min(Math.max(value, EDGE_PX), max - EDGE_PX);

    // Правым краем — к кнопке (меню раскрывалось влево), верхом — на её строке;
    // у края экрана окно сдвигается внутрь
    const left = clamp(anchor.right - width, window.innerWidth - width);
    const top = clamp(anchor.top, window.innerHeight - height);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.transformOrigin = `${anchor.left + anchor.width / 2 - left}px ${
      anchor.top + anchor.height / 2 - top
    }px`;

    const closed = (event) => {
      if (event.newState === 'closed') setTimeout(onClose, LEAVE_MS);
    };
    box.addEventListener('toggle', closed);
    box.showPopover();
    // Открыли, чтобы выбрать, — курсор сразу в поиске
    box.querySelector('input')?.focus();

    return () => box.removeEventListener('toggle', closed);
    // Окно ставится один раз — на время жизни оно не переезжает
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Сам список едет своим файлом: окно открывается сразу, знаки приходят следом
  useEffect(() => {
    let alive = true;
    import('../emoji.js').then((module) => {
      if (!alive) return;
      setGroups(module.EMOJI_GROUPS);
      setActive(module.EMOJI_GROUPS[0].id);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Своя реакция уже стоит — открываемся на ней
  useEffect(() => {
    if (!groups) return;
    const mine = bodyRef.current?.querySelector('[aria-pressed="true"]');
    if (mine) bodyRef.current.scrollTop = mine.offsetTop - bodyRef.current.clientHeight / 2;
  }, [groups]);

  function go(id) {
    const section = bodyRef.current.querySelector(`[data-group="${id}"]`);
    bodyRef.current.scrollTo({ top: section.offsetTop, behavior: 'smooth' });
    setActive(id);
  }

  /** Подсвечена группа, заголовок которой уже ушёл под верх ленты. */
  function track() {
    if (found) return;
    const body = bodyRef.current;
    let current = groups[0].id;
    for (const section of body.children) {
      if (section.offsetTop <= body.scrollTop + 1) current = section.dataset.group;
    }
    setActive(current);
  }

  function pick(emoji) {
    onPick(emoji);
    ref.current.hidePopover();
  }

  /** Одна клетка сетки: сам знак, название — в подсказке. */
  const cell = ([emoji, name]) => (
    <button
      key={emoji}
      className={`emoji__item${emoji === chosen ? ' emoji__item--chosen' : ''}`}
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={emoji === chosen}
      onClick={() => pick(emoji)}
    >
      {emoji}
    </button>
  );

  return (
    <div className="emoji" popover="auto" ref={ref} role="dialog" aria-label="Все реакции">
      <div className="emoji__search">
        <SearchField
          label="Поиск эмодзи"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery('')}
        />
      </div>

      {/* Пока ищут, группы молчат: находки идут одной сеткой, из всех сразу */}
      {!found && groups && (
        <div className="emoji__tabs" role="tablist">
          {groups.map((group) => {
            const Icon = ICONS[group.id];
            return (
              <button
                key={group.id}
                className="emoji__tab"
                type="button"
                role="tab"
                aria-selected={active === group.id}
                aria-label={group.title}
                title={group.title}
                onClick={() => go(group.id)}
              >
                <Icon aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      <div className="emoji__body" ref={bodyRef} onScroll={track}>
        {found ? (
          found.length === 0 ? (
            <p className="emoji__empty">Ничего не нашли</p>
          ) : (
            <div className="emoji__grid">{found.map(cell)}</div>
          )
        ) : (
          groups?.map((group) => (
            /* Каждая группа — своя секция: заголовок липнет только внутри неё,
               и следующий выталкивает его вверх, а не ложится поверх */
            <section key={group.id} className="emoji__group" data-group={group.id}>
              <h3 className="emoji__title">{group.title}</h3>
              <div className="emoji__grid">{group.list.map(cell)}</div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
