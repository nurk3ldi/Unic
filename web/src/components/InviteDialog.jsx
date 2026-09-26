import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Person from './Person.jsx';
import SearchField from './SearchField.jsx';
import './InviteDialog.css';

// Столько же принимает сервер
const NOTE_LIMIT = 300;
// Пауза после набора, прежде чем спрашивать сервер: не на каждую букву
const SEARCH_DELAY_MS = 250;

// Кого нельзя выбрать и почему; заявку подавшего выбрать можно — он войдёт сразу
const STATUS_LABELS = { active: 'В клубе', invited: 'Приглашён', pending: 'Подал заявку' };

/**
 * Окно приглашения в клуб: найти человека, выбрать, написать пару слов.
 * В клуб он не попадает — ему приходит приглашение, и участником он
 * становится, только когда сам его примет.
 *
 * `session` растёт при каждом открытии: форма монтируется заново чистой,
 * но не при закрытии, пока окно ещё растворяется.
 */
export default function InviteDialog({ clubId, open, session, onClose, onInvited }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // autoFocus не срабатывает: поле смонтировано до открытия окна
      dialog.querySelector('input')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className="modal invite"
      ref={dialogRef}
      // Эхо прошлого закрытия не принимаем за новое (см. AccountSecurity)
      onClose={() => !dialogRef.current?.open && onClose()}
      aria-label="Пригласить в клуб"
    >
      <InviteForm key={session} clubId={clubId} onCancel={onClose} onInvited={onInvited} />
    </dialog>
  );
}

function InviteForm({ clubId, onCancel, onInvited }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Поиск с паузой: запрос уходит, когда человек перестал печатать
  useEffect(() => {
    const text = query.trim();
    if (text.replace(/^@/, '').length < 2) {
      setFound([]);
      setSearched(false);
      return undefined;
    }

    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const { candidates } = await api.clubCandidates(clubId, text);
        if (alive) {
          setFound(candidates);
          setSearched(true);
        }
      } catch (failure) {
        if (alive) setError(failure.message);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [clubId, query]);

  async function submit(event) {
    event.preventDefault();
    if (!picked) return;

    setBusy(true);
    setError('');
    try {
      const { status } = await api.inviteMember(clubId, { userId: picked.id, note });
      onInvited(status);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <form className="modal__form" onSubmit={submit} noValidate>
      <h2 className="modal__title">Пригласить в клуб</h2>

      {picked ? (
        // Выбранный — одной строкой; передумать можно, не закрывая окна
        <div className="invite__picked">
          <Person person={picked} />
          <button className="invite__change" type="button" onClick={() => setPicked(null)}>
            Изменить
          </button>
        </div>
      ) : (
        <div className="invite__search">
          <SearchField
            label="Имя, ник или почта"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setError('');
            }}
            onClear={() => setQuery('')}
          />

          {found.length > 0 ? (
            <ul className="invite__results">
              {found.map((person) => (
                <li key={person.id}>
                  <button
                    className="member invite__option"
                    type="button"
                    // Кто уже в клубе или приглашён — виден, но не выбирается
                    disabled={person.status === 'active' || person.status === 'invited'}
                    onClick={() => setPicked(person)}
                  >
                    <Person person={person} />
                    {person.status && (
                      <span className="invite__status">{STATUS_LABELS[person.status]}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            // Пока ничего не искали — подсказки нет: поле само говорит, что в него вводить
            searched && <p className="invite__hint">Никого не нашли</p>
          )}
        </div>
      )}

      <label className="visually-hidden" htmlFor="invite-note">
        Сообщение
      </label>
      <textarea
        id="invite-note"
        className="invite__note"
        rows={4}
        maxLength={NOTE_LIMIT}
        placeholder="Сообщение — необязательно"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      {error && (
        <p className="invite__error" role="alert">
          {error}
        </p>
      )}

      <div className="modal__actions">
        <button className="modal__button" type="button" onClick={onCancel}>
          Отмена
        </button>
        <button
          className="modal__button modal__button--primary"
          type="submit"
          disabled={!picked || busy}
        >
          {busy ? 'Отправляем…' : 'Пригласить'}
        </button>
      </div>
    </form>
  );
}
