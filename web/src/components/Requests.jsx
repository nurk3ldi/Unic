import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { initial } from '../people.js';
import './Requests.css';

// Приглашения приходят редко — спрашиваем реже, чем чат
const POLL_MS = 30_000;

// Больше девяти не показываем: счётчик — про «сколько ждёт», а не про точное число
const MAX = 9;

/**
 * Правая колонка: приглашения в клубы, которые ждут ответа. Заголовок со
 * счётчиком, под ним — карточка на каждое приглашение с двумя кнопками.
 *
 * Счётчик серый, пока ждать нечего, и брендовый, как только появилось хоть одно:
 * цвет и есть сообщение, читать число для этого не нужно.
 */
export default function Requests() {
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(null); // id клуба, по которому ждём ответа

  const load = useCallback(() => {
    if (document.hidden) return;
    api
      .invites()
      .then(({ invites }) => setInvites(invites))
      .catch(() => {
        // Молча: колонка — не место для ошибок сети, следующий опрос попробует снова
      });
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
    try {
      await (accept ? api.acceptInvite(clubId) : api.declineInvite(clubId));
      setInvites((current) => current.filter((item) => item.club.id !== clubId));
    } catch {
      load(); // не вышло — показываем то, что на сервере на самом деле
    } finally {
      setBusy(null);
    }
  }

  const count = invites.length;

  // Ждать нечего — раздела нет совсем: пустой заголовок с нулём ничего не сообщает
  if (count === 0) return null;

  return (
    <>
      <section className="requests">
        <h2 className="requests__title">Приглашения</h2>

        <span className="requests__count" aria-label={`Приглашений: ${count}`}>
          {count > MAX ? `${MAX}+` : count}
        </span>
      </section>

      {invites.map(({ club, inviter }) => (
        <article className="invite" key={club.id}>
          <div className="invite__head">
            <span className="invite__photo">
              {club.photo ? <img src={club.photo} alt="" /> : initial(club.name)}
            </span>

            {/* Кто зовёт — именем клуба: оно и есть главное слово строки */}
            <p className="invite__text">
              <strong>{club.name}</strong> приглашает вас в клуб
              {inviter && <span className="invite__from">от {inviter}</span>}
            </p>
          </div>

          <div className="invite__actions">
            <button
              className="invite__button invite__button--accept"
              type="button"
              disabled={busy === club.id}
              onClick={() => answer(club.id, true)}
            >
              Принять
            </button>

            <button
              className="invite__button"
              type="button"
              disabled={busy === club.id}
              onClick={() => answer(club.id, false)}
            >
              Отклонить
            </button>
          </div>
        </article>
      ))}
    </>
  );
}
