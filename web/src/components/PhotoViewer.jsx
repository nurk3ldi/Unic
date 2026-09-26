import { useEffect, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import './PhotoViewer.css';

/**
 * Снимок на весь экран поверх страницы. Нативный <dialog>: Esc, фокус и верхний
 * слой даёт платформа. Клик мимо фото — тоже выход: так закрывают любое окно.
 * Нужен и ленте, и разделу «Медиа», поэтому живёт отдельно.
 */
export default function PhotoViewer({ photo, onClose }) {
  const dialogRef = useRef(null);
  // Окно держит последний снимок, пока растворяется, — иначе он пропал бы раньше окна
  const shown = useRef(null);
  if (photo) shown.current = photo;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (photo && !dialog.open) dialog.showModal();
    if (!photo && dialog.open) dialog.close();
  }, [photo]);

  return (
    <dialog
      className="photo-viewer"
      ref={dialogRef}
      aria-label="Просмотр фото"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {shown.current && <img className="photo-viewer__image" src={shown.current.url} alt="" />}

      <button className="photo-viewer__close" type="button" aria-label="Закрыть" onClick={onClose}>
        <IoClose aria-hidden="true" />
      </button>
    </dialog>
  );
}
