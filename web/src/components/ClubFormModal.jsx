import { useEffect, useRef, useState } from 'react';
import { IoAdd, IoImageOutline } from 'react-icons/io5';
import Field from './Field.jsx';
import './ClubFormModal.css';

/**
 * Создание клуба. Нативный <dialog>: затемнение, Esc и ловушка фокуса — от платформы.
 * Фото пока живёт только в браузере: загрузку на сервер добавим вместе с таблицей clubs.
 */
export default function ClubFormModal({ open, onClose, onCreate }) {
  const dialogRef = useRef(null);
  const fileRef = useRef(null);

  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');

  // Открываем и закрываем средствами самого элемента, иначе не будет backdrop и фокуса
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // autoFocus не срабатывает: элемент смонтирован до открытия окна
      dialog.querySelector('input[name="name"]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Ссылку на файл нужно отзывать, иначе она держит память
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

  function reset() {
    setName('');
    setPhoto(null);
    setError('');
  }

  function pickPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhoto({ file, url: URL.createObjectURL(file) });
    event.target.value = ''; // чтобы тот же файл можно было выбрать снова
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (name.trim().length < 2) {
      setError('Укажите название клуба');
      return;
    }

    onCreate({ name: name.trim(), photo: photo?.url ?? null });
    reset();
    onClose();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <dialog className="modal" ref={dialogRef} onClose={handleClose}>
      <form className="modal__form" onSubmit={handleSubmit} noValidate>
        <h2 className="modal__title">Новый клуб</h2>

        <button
          className={`photo-picker${photo ? ' photo-picker--filled' : ''}`}
          type="button"
          onClick={() => fileRef.current?.click()}
        >
          {photo ? (
            <img className="photo-picker__image" src={photo.url} alt="" />
          ) : (
            <span className="photo-picker__hint">
              <IoImageOutline aria-hidden="true" />
              Добавить фото
            </span>
          )}
        </button>

        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={pickPhoto}
        />

        <Field
          label="Название клуба"
          name="name"
          value={name}
          error={error}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
        />

        <div className="modal__actions">
          <button className="modal__button" type="button" onClick={handleClose}>
            Отмена
          </button>
          <button className="modal__button modal__button--primary" type="submit">
            <IoAdd aria-hidden="true" />
            Создать
          </button>
        </div>
      </form>
    </dialog>
  );
}
