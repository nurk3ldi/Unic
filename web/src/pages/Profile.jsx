import { useRef, useState } from 'react';
import { IoLogOutOutline } from 'react-icons/io5';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { ROLE_LABELS, formatPhone, initial } from '../people.js';
import { squareDataUrl } from '../photo.js';
import './Page.css';
import './Profile.css';

const since = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

// Профиль университета (и админа — права те же) собирается заново, по шагу
const OVERSEE_ROLES = ['university', 'admin'];

/** Профиль. У студента — визитка, как страница Apple ID: кто ты, сведения, выход. */
export default function Profile() {
  const { user } = useAuth();

  if (OVERSEE_ROLES.includes(user.role)) {
    return (
      <main className="page">
        <section className="profile-card">
          <PhotoSquare />
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="profile">
        <Identity />
      </div>
    </main>
  );
}

/** Визитка: кто это, контакты, выход. Выход без подтверждения — войти можно снова (§4.7). */
function Identity() {
  const { user, signOut } = useAuth();

  return (
    <>
      <div className="profile__hero">
        <span className="profile__avatar" aria-hidden="true">
          {initial(user.fullName)}
        </span>
        <h1 className="profile__name">{user.fullName}</h1>
        <p className="profile__nick">@{user.username}</p>
      </div>

      <dl className="group profile__group">
        <div className="group__row">
          <dt className="group__label">Почта</dt>
          <dd className="profile__value">{user.email}</dd>
        </div>
        <div className="group__row">
          <dt className="group__label">Номер</dt>
          <dd className="profile__value">{formatPhone(user.phone)}</dd>
        </div>
        <div className="group__row">
          <dt className="group__label">Роль</dt>
          <dd className="profile__value">{ROLE_LABELS[user.role] ?? user.role}</dd>
        </div>
        {user.createdAt && (
          <div className="group__row">
            <dt className="group__label">В Unic с</dt>
            <dd className="profile__value">{since.format(new Date(user.createdAt))}</dd>
          </div>
        )}
      </dl>

      {/* Выход — отдельной группой в самом низу: до него доходят, а не натыкаются */}
      <div className="group profile__group">
        <button className="group__row profile__signout" type="button" onClick={signOut}>
          <IoLogOutOutline aria-hidden="true" />
          Выйти
        </button>
      </div>
    </>
  );
}

/**
 * Логотип университета квадратом в левом верхнем углу. Нажатие — выбрать новый.
 * Снимок ужимается и кадрируется в браузере, как фото клуба, и уходит обычным JSON.
 */
function PhotoSquare() {
  const { user, setUser } = useAuth();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // тот же файл можно выбрать снова
    if (!file) return;

    setBusy(true);
    try {
      const { user: updated } = await api.setPhoto(await squareDataUrl(file));
      setUser(updated);
      setError('');
    } catch (failure) {
      setError(
        failure.message === 'broken image'
          ? 'Не удалось прочитать фото. Выберите JPEG или PNG.'
          : failure.message,
      );
    } finally {
      setBusy(false);
    }
  }

  const action = user.photo ? 'Изменить фото' : 'Добавить фото';

  return (
    <>
      <button
        className="profile__photo"
        type="button"
        aria-label={action}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {user.photo ? (
          <img src={user.photo} alt="" />
        ) : (
          <span aria-hidden="true">{initial(user.fullName)}</span>
        )}
        {/* Подсказка появляется при наведении: в покое квадрат — просто логотип */}
        <span className="profile__photo-hint" aria-hidden="true">
          {action}
        </span>
      </button>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />

      {error && (
        <p className="profile__photo-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
