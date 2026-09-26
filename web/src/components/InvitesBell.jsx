import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoNotificationsOutline } from 'react-icons/io5';
import { api } from '../api.js';
import { initial } from '../people.js';
import './InvitesBell.css';

// Приглашения приходят редко — спрашиваем реже, чем чат
const POLL_MS = 30_000;

/**
 * Колокольчик в шапке: приглашения в клубы, которые ждут ответа. Число на значке —
 * сколько их; по нажатию — список: какой клуб, кто позвал, что написал,
 * и две кнопки. Участником человек становится только нажав «Принять».
 *
 * Список — нативный popover: закрывается кликом мимо и Esc, живёт в верхнем
 * слое, своего JS для этого нет.
 */
export default function InvitesBell() {
  const navigate = useNavigate();
  const popoverRef = useRef(null);
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(null); // id клуба, по которому ждём ответа
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (document.hidden) return;
    try {
      const { invites } = await api.invites();
      setInvites(invites);
    } catch {
      // Молча: колокольчик — не место для ошибок сети, следующий опрос попробует снова
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  async function answer(clubId, accept) {
    setBusy(clubId);
    setError('');
    try {
      await (accept ? api.acceptInvite(clubId) : api.declineInvite(clubId));
      setInvites((was) => was.filter((invite) => invite.club.id !== clubId));
      // Принял — сразу в свой новый клуб
      if (accept) {
        popoverRef.current?.hidePopover();
        navigate(`/clubs/${clubId}`, { viewTransition: true });
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(null);
    }
  }

  const count = invites.length;

  return (
    <>
      <button
        className="bell"
        type="button"
        popoverTarget="invites"
        aria-label={count ? `Приглашения: ${count}` : 'Приглашения'}
        onClick={load}
      >
        <IoNotificationsOutline aria-hidden="true" />
        {count > 0 && <span className="bell__badge">{count}</span>}
      </button>

      <div className="invites" id="invites" popover="auto" ref={popoverRef}>
        <h2 className="invites__title">Приглашения</h2>

        {count === 0 ? (
          <p className="invites__empty">Новых приглашений нет</p>
        ) : (
          <ul className="invites__list">
            {invites.map(({ club, note, inviter }) => (
              <li className="invite-card" key={club.id}>
                <div className="invite-card__head">
                  <span className="invite-card__photo">
                    {club.photo ? (
                      <img src={club.photo} alt="" />
                    ) : (
                      <span aria-hidden="true">{initial(club.name)}</span>
                    )}
                  </span>
                  <p className="invite-card__text">
                    <strong>{club.name}</strong> приглашает вас в клуб
                    {inviter && <span className="invite-card__from">от {inviter}</span>}
                  </p>
                </div>

                {/* Слова приглашающего — отдельным пузырём, как реплика в чате */}
                {note && <p className="invite-card__note">{note}</p>}

                <div className="invite-card__actions">
                  <button
                    className="invite-card__button"
                    type="button"
                    disabled={busy === club.id}
                    onClick={() => answer(club.id, false)}
                  >
                    Отклонить
                  </button>
                  <button
                    className="invite-card__button invite-card__button--accept"
                    type="button"
                    disabled={busy === club.id}
                    onClick={() => answer(club.id, true)}
                  >
                    Принять
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="invites__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
