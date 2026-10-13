import { useEffect, useId, useRef, useState } from 'react';
import { IconCalendar, IconChevronLeft, IconChevronRight } from '../icons.jsx';
import { eventDate } from '../events.js';
import './Field.css';
import './DateTimeField.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);
// Шаг в пять минут: встречи назначают на ровное время, а список остаётся коротким
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
// Куда прокручены часы, пока время не выбрано: встречи клубов чаще вечером
const USUAL_HOUR = 18;

const two = (number) => String(number).padStart(2, '0');
const dayKey = (date) => `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
const fullDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

/** Значение — как у системного datetime-local: «2026-11-05T18:30», местное время. */
function parse(value) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value ?? '');
  return match
    ? { day: match[1], hour: Number(match[2]), minute: Number(match[3]) }
    : { day: '', hour: null, minute: null };
}

/** 42 дня с понедельника: всегда шесть недель, высота не прыгает от месяца к месяцу. */
function monthDays(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(year, month, 1 - offset + index));
}

/**
 * Дата и время события. Системное поле показывает календарь на языке браузера
 * и с AM/PM — здесь свой: по-русски, неделя с понедельника, сутки в 24 часа.
 * Открывает его сам браузер (popover): Esc и щелчок мимо закрывают, верхний
 * слой не даёт карточке его обрезать. Значение — та же строка, что у
 * datetime-local; пока выбран только день или только время, оно пустое.
 */
export default function DateTimeField({ label, value, error, onChange }) {
  const id = useId();
  const boxRef = useRef(null);
  const popRef = useRef(null);

  const [draft, setDraft] = useState(() => parse(value));
  const [view, setView] = useState(() => {
    const base = draft.day ? new Date(`${draft.day}T00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  // Место окну известно только когда оно открыто: тогда же часы и минуты
  // прокручиваются к выбранным
  useEffect(() => {
    const pop = popRef.current;

    function opened(event) {
      if (event.newState !== 'open') return;

      const rect = boxRef.current.getBoundingClientRect();
      const page = document.documentElement;
      const gap = 8;
      // Вниз, если помещается — или если наверху места ещё меньше
      const below =
        rect.bottom + gap + pop.offsetHeight <= page.clientHeight ||
        rect.top < pop.offsetHeight + gap;
      const top = below ? rect.bottom + gap : rect.top - gap - pop.offsetHeight;
      // По левому краю поля, но не ближе 16px к краям окна — на телефоне выходит по центру
      const left = Math.max(16, Math.min(rect.left, page.clientWidth - pop.offsetWidth - 16));
      // Координаты страницы, а не окна: при прокрутке календарь едет вместе с полем
      pop.style.top = `${top + window.scrollY}px`;
      pop.style.left = `${left + window.scrollX}px`;
      pop.dataset.side = below ? 'below' : 'above';

      for (const column of pop.querySelectorAll('.datetime__column')) {
        const slot =
          column.querySelector('[aria-pressed="true"]') ?? column.querySelector('[data-usual]');
        if (slot) column.scrollTop = slot.offsetTop - (column.clientHeight - slot.offsetHeight) / 2;
      }
    }

    pop.addEventListener('toggle', opened);
    return () => pop.removeEventListener('toggle', opened);
  }, []);

  function update(patch) {
    const next = { ...draft, ...patch };
    // Час без минут — ровно час
    if (next.hour !== null && next.minute === null) next.minute = 0;
    setDraft(next);
    onChange(
      next.day && next.hour !== null ? `${next.day}T${two(next.hour)}:${two(next.minute)}` : '',
    );
  }

  function turn(step) {
    const next = new Date(view.year, view.month + step, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  }

  function pickToday() {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
    update({ day: dayKey(now) });
  }

  const today = dayKey(new Date());
  const date = draft.day ? new Date(`${draft.day}T00:00`) : null;
  const time = draft.hour !== null ? `${two(draft.hour)}:${two(draft.minute)}` : '';

  // Поле говорит, чего ещё не хватает: значение появится только с днём и временем
  let text = label;
  if (date && time) text = `${eventDate(date)}, ${time}`;
  else if (date) text = `${eventDate(date)} — выберите время`;
  else if (time) text = `${time} — выберите день`;

  const month = monthName.format(new Date(view.year, view.month, 1));

  return (
    <div className="field">
      <div className={`field__box${error ? ' field__box--error' : ''}`} ref={boxRef}>
        <button
          className={`field__input datetime__trigger${date && time ? '' : ' datetime__trigger--empty'}`}
          type="button"
          aria-label={date && time ? `${label}: ${text}` : label}
          aria-haspopup="dialog"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          popoverTarget={id}
        >
          <span>{text}</span>
          <IconCalendar aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}

      <div className="datetime" id={id} ref={popRef} popover="auto" role="dialog" aria-label={label}>
        <div className="datetime__body">
          <div className="datetime__calendar">
            <div className="datetime__head">
              <span className="datetime__month" aria-live="polite">
                {month[0].toUpperCase() + month.slice(1)} <span>{view.year}</span>
              </span>
              <span className="datetime__turns">
                <button
                  className="datetime__turn"
                  type="button"
                  aria-label="Предыдущий месяц"
                  onClick={() => turn(-1)}
                >
                  <IconChevronLeft aria-hidden="true" />
                </button>
                <button
                  className="datetime__turn"
                  type="button"
                  aria-label="Следующий месяц"
                  onClick={() => turn(1)}
                >
                  <IconChevronRight aria-hidden="true" />
                </button>
              </span>
            </div>

            <div className="datetime__weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="datetime__days">
              {monthDays(view.year, view.month).map((day) => {
                const key = dayKey(day);
                return (
                  <button
                    key={key}
                    className={`datetime__day${day.getMonth() === view.month ? '' : ' datetime__day--away'}${key === today ? ' datetime__day--today' : ''}`}
                    type="button"
                    aria-label={fullDay.format(day)}
                    aria-pressed={key === draft.day}
                    onClick={() => update({ day: key })}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="datetime__time">
            <div className="datetime__head">
              <span className="datetime__month">Время</span>
            </div>
            <div className="datetime__columns">
              <div className="datetime__column" role="group" aria-label="Часы">
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    className="datetime__slot"
                    type="button"
                    aria-label={`${hour} ч`}
                    aria-pressed={hour === draft.hour}
                    data-usual={hour === USUAL_HOUR ? '' : undefined}
                    onClick={() => update({ hour })}
                  >
                    {two(hour)}
                  </button>
                ))}
              </div>
              <div className="datetime__column" role="group" aria-label="Минуты">
                {MINUTES.map((minute) => (
                  <button
                    key={minute}
                    className="datetime__slot"
                    type="button"
                    aria-label={`${minute} мин`}
                    aria-pressed={minute === draft.minute}
                    onClick={() => update({ minute })}
                  >
                    {two(minute)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="datetime__foot">
          <button className="datetime__action" type="button" onClick={pickToday}>
            Сегодня
          </button>
          <button
            className="datetime__action datetime__action--done"
            type="button"
            onClick={() => popRef.current.hidePopover()}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
