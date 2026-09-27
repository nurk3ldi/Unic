import { useLayoutEffect, useRef, useState } from 'react';
import {
  IoAirplaneOutline,
  IoBulbOutline,
  IoFastFoodOutline,
  IoFootballOutline,
  IoHappyOutline,
  IoHeartOutline,
  IoLeafOutline,
} from 'react-icons/io5';
import { EMOJI_GROUPS } from '../emoji.js';
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
 * и растёт из кнопки «+» (§4.3). Сверху — группы, как на клавиатуре Apple: нажатие
 * листает к группе, при прокрутке подсвечивается видимая.
 *
 * `anchor` — прямоугольник кнопки «+», `chosen` — своя реакция (подсвечена;
 * нажать её ещё раз — убрать).
 */
export default function EmojiPicker({ anchor, chosen, onPick, onClose }) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const [active, setActive] = useState(EMOJI_GROUPS[0].id);

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

    // Своя реакция уже стоит — окно открывается на ней
    const mine = bodyRef.current.querySelector('[aria-pressed="true"]');
    if (mine) bodyRef.current.scrollTop = mine.offsetTop - bodyRef.current.clientHeight / 2;

    return () => box.removeEventListener('toggle', closed);
    // Окно ставится один раз — на время жизни оно не переезжает
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(id) {
    const section = bodyRef.current.querySelector(`[data-group="${id}"]`);
    bodyRef.current.scrollTo({ top: section.offsetTop, behavior: 'smooth' });
    setActive(id);
  }

  /** Подсвечена группа, заголовок которой уже ушёл под верх ленты. */
  function track() {
    const body = bodyRef.current;
    let current = EMOJI_GROUPS[0].id;
    for (const section of body.children) {
      if (section.offsetTop <= body.scrollTop + 1) current = section.dataset.group;
    }
    setActive(current);
  }

  function pick(emoji) {
    onPick(emoji);
    ref.current.hidePopover();
  }

  return (
    <div className="emoji" popover="auto" ref={ref} role="dialog" aria-label="Все реакции">
      <div className="emoji__tabs" role="tablist">
        {EMOJI_GROUPS.map((group) => {
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

      <div className="emoji__body" ref={bodyRef} onScroll={track}>
        {EMOJI_GROUPS.map((group) => (
          /* Каждая группа — своя секция: заголовок липнет только внутри неё,
             и следующий выталкивает его вверх, а не ложится поверх */
          <section key={group.id} className="emoji__group" data-group={group.id}>
            <h3 className="emoji__title">{group.title}</h3>
            <div className="emoji__grid">
              {group.list.map((emoji) => (
                <button
                  key={emoji}
                  className={`emoji__item${emoji === chosen ? ' emoji__item--chosen' : ''}`}
                  type="button"
                  aria-pressed={emoji === chosen}
                  onClick={() => pick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
