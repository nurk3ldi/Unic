import { useEffect, useRef, useState } from 'react';
import { IoAdd, IoImageOutline } from 'react-icons/io5';
import Field from './Field.jsx';
import './ClubFormModal.css';

const PHOTO_SIZE = 400;

/**
 * Ужимает картинку до квадрата PHOTO_SIZE и возвращает data URL.
 * Кадрирование «по центру» — ровно то, что делает object-fit: cover в карточке.
 */
function squareDataUrl(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = PHOTO_SIZE;
      canvas.height = PHOTO_SIZE;

      const scale = Math.max(PHOTO_SIZE / image.width, PHOTO_SIZE / image.height);
      const width = image.width * scale;
      const height = image.height * scale;

      const context = canvas.getContext('2d');
      context.drawImage(image, (PHOTO_SIZE - width) / 2, (PHOTO_SIZE - height) / 2, width, height);

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('broken image'));
    };

    image.src = objectUrl;
  });
}

/**
 * Создание клуба. Нативный <dialog>: затемнение, Esc и ловушка фокуса — от платформы.
 * Фото ужимается до квадрата 400×400 и уходит на сервер строкой data URL —
 * так обходимся без загрузки файлов и лишней зависимости.
 */
export default function ClubFormModal({ open, onClose, onCreate }) {
  const dialogRef = useRef(null);
  const fileRef = useRef(null);

  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  function reset() {
    setName('');
    setPhoto(null);
    setError('');
  }

  async function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // чтобы тот же файл можно было выбрать снова
    if (!file) return;

    try {
      setPhoto({ url: await squareDataUrl(file) });
      setError('');
    } catch {
      setError('Не удалось прочитать изображение');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (name.trim().length < 2) {
      setError('Укажите название клуба');
      return;
    }

    setBusy(true);
    try {
      await onCreate({ name: name.trim(), photo: photo?.url ?? null });
      reset();
      onClose();
    } catch (failure) {
      setError(failure.message);
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
          <button
            className="modal__button modal__button--primary"
            type="submit"
            disabled={busy}
          >
            <IoAdd aria-hidden="true" />
            {busy ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
