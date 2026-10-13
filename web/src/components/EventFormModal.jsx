import { useEffect, useId, useRef, useState } from 'react';
import { IconChevronDown, IconPlus } from '../icons.jsx';
import Field from './Field.jsx';
import './EventFormModal.css';

const EMPTY = { title: '', startsAt: '', place: '' };

// Те же пределы, что проверяет сервер
const TITLE_LIMIT = 120;
const PLACE_LIMIT = 200;

/**
 * Новое событие клуба. Нативный <dialog>, как у создания клуба: затемнение, Esc
 * и ловушка фокуса — от платформы. Клуб выбирают из тех, которыми человек
 * распоряжается (`clubs`), дату и время — системным полем.
 */
export default function EventFormModal({ open, clubs, onClose, onCreate }) {
  const dialogRef = useRef(null);
  const clubFieldId = useId();

  const [club, setClub] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Пока клуб не выбран руками — первый из списка; он же, если выбранный исчез
  const chosen = clubs.some((item) => item.id === club) ? club : (clubs[0]?.id ?? '');

  // Открываем и закрываем средствами самого элемента, иначе не будет backdrop и фокуса
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // autoFocus не срабатывает: элемент смонтирован до открытия окна
      dialog.querySelector('input[name="title"]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function reset() {
    setClub('');
    setForm(EMPTY);
    setErrors({});
  }

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '', form: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const title = form.title.trim();
    const startsAt = new Date(form.startsAt);
    const found = {};
    if (title.length < 2) found.title = 'Укажите название события';
    // Number.isNaN у пустой или кривой даты — единственный способ её поймать
    if (Number.isNaN(startsAt.getTime())) found.startsAt = 'Укажите дату и время';
    if (found.title || found.startsAt) {
      setErrors(found);
      return;
    }

    setBusy(true);
    try {
      await onCreate(chosen, {
        title,
        place: form.place.trim() || null,
        startsAt: startsAt.toISOString(),
      });
      reset();
      onClose();
    } catch (failure) {
      setErrors({ form: failure.message });
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <dialog className="modal" ref={dialogRef} onClose={handleClose}>
      <form className="modal__form" onSubmit={handleSubmit} noValidate>
        <h2 className="modal__title">Новое событие</h2>

        <div className="field">
          <label className="visually-hidden" htmlFor={clubFieldId}>
            Клуб
          </label>
          <div className="field__box event-form__select">
            <select
              id={clubFieldId}
              className="field__input"
              value={chosen}
              onChange={(event) => setClub(event.target.value)}
            >
              {clubs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <IconChevronDown aria-hidden="true" />
          </div>
        </div>

        <Field
          label="Название события"
          name="title"
          maxLength={TITLE_LIMIT}
          value={form.title}
          error={errors.title}
          onChange={change}
        />

        <Field
          label="Дата и время"
          name="startsAt"
          type="datetime-local"
          className={form.startsAt ? '' : 'event-form__date--empty'}
          value={form.startsAt}
          error={errors.startsAt}
          onChange={change}
        />

        <Field
          label="Место"
          placeholder="Место (необязательно)"
          name="place"
          maxLength={PLACE_LIMIT}
          value={form.place}
          error={errors.form}
          onChange={change}
        />

        <div className="modal__actions">
          <button className="modal__button" type="button" onClick={handleClose}>
            Отмена
          </button>
          <button
            className="modal__button modal__button--primary"
            type="submit"
            disabled={busy}
          >
            <IconPlus aria-hidden="true" />
            {busy ? 'Добавляем…' : 'Добавить'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
