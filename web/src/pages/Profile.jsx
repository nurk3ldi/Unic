import { useEffect, useRef, useState } from 'react';
import { IoLogOutOutline } from 'react-icons/io5';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { ROLE_LABELS, formatPhone, initial } from '../people.js';
import { squareDataUrl } from '../photo.js';
import AccountSecurity from '../components/AccountSecurity.jsx';
import './Page.css';
import './Profile.css';

const since = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

// Профиль университета (и админа — права те же) собирается заново, по шагу
const OVERSEE_ROLES = ['university', 'admin'];

/** Профиль. У студента — визитка, как страница Apple ID: кто ты, сведения, выход. */
export default function Profile() {
  const { user, signOut } = useAuth();

  if (OVERSEE_ROLES.includes(user.role)) {
    return (
      <main className="page">
        {/* Как верхняя карточка клуба: слева снимок, справа — кто это */}
        <section className="profile-card">
          {/* Логотип и сведения — одной строкой: сведения растягиваются на высоту логотипа */}
          <div className="profile-card__head">
            <PhotoSquare />
            <UniversityInfo />
          </div>

          {/* Выход — в самом низу карточки, подальше от правок: до него доходят, а не
              натыкаются. Без подтверждения — ничего не теряется, войти можно снова */}
          <button className="profile-card__signout" type="button" onClick={signOut}>
            <IoLogOutOutline aria-hidden="true" />
            Выйти из аккаунта
          </button>
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

  /** Убрать фото: вернётся буква. Без подтверждения — поставить снова можно в два нажатия. */
  async function remove() {
    setBusy(true);
    try {
      const { user: updated } = await api.setPhoto(null);
      setUser(updated);
      setError('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    // Своя колонка: снимок и сообщение об ошибке под ним — одним столбцом слева
    <div className="profile__photo-box">
      {/* Квадрат — не кнопка: внутри него две кнопки, а кнопка в кнопке недопустима */}
      <div className={`profile__photo${busy ? ' profile__photo--busy' : ''}`}>
        {user.photo ? (
          <img src={user.photo} alt="" />
        ) : (
          <span aria-hidden="true">{initial(user.fullName)}</span>
        )}

        {/* Действия стоят на самом снимке, внизу, и появляются при наведении:
            в покое квадрат — просто логотип. Удалять нечего — остаётся одна кнопка */}
        <div className="profile__photo-actions">
          {user.photo && (
            <button
              className="profile__photo-button profile__photo-button--danger"
              type="button"
              disabled={busy}
              onClick={remove}
            >
              Удалить
            </button>
          )}
          <button
            className="profile__photo-button"
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {user.photo ? 'Изменить' : 'Добавить'}
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />

      {error && (
        <p className="profile__photo-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Как дата регистрации читается в сведениях: «20 сентября 2026 г.»
const joined = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const formOf = (user) => ({ fullName: user.fullName });

/**
 * Сведения справа от логотипа: название, под ним сетка «подпись — значение»,
 * по две пары в строке. Подпись мелкая и серая — что это; значение тёмное — само дело.
 *
 * Правка — как на странице клуба (образец — ассистент в AIRec): «Редактировать» в правом
 * верхнем углу становится «Готово», рядом выезжает «Отмена». Правится только название:
 * оно всегда поле, правка лишь снимает readOnly и показывает рамку. Ник, почта и пароль —
 * отдельные действия, не часть этой правки.
 * «Готово» и есть сохранение; ничего не менялось — запрос не уходит.
 */
function UniversityInfo() {
  const { user, setUser } = useAuth();
  const nameRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => formOf(user));

  // Окно смены ника, почты или пароля; номер растёт при каждом открытии — форма чистая
  const [dialog, setDialog] = useState(null);
  const [session, setSession] = useState(0);
  const change = (kind) => {
    setSession((count) => count + 1);
    setDialog(kind);
  };

  useEffect(() => {
    let alive = true;
    api
      .clubStats()
      .then(({ stats }) => alive && setStats(stats))
      .catch((failure) => alive && setError(failure.message));
    return () => {
      alive = false;
    };
  }, []);

  // Сравнение с записью, а не флаг: флаг пришлось бы гасить в каждом пути
  const isDirty = JSON.stringify(form) !== JSON.stringify(formOf(user));

  function start() {
    setForm(formOf(user));
    setError('');
    setEditing(true);
    // Правку начинают с названия — фокус сразу там
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  function cancel() {
    setForm(formOf(user));
    setError('');
    setEditing(false);
  }

  async function done() {
    if (!isDirty) return setEditing(false);

    setSaving(true);
    try {
      const { user: saved } = await api.updateMe({ fullName: form.fullName.trim() });
      setUser(saved);
      setError('');
      setEditing(false);
    } catch (failure) {
      // Остаёмся в правке с тем, что набрано: неудавшееся сохранение всё ещё хотят сохранить
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  /** Enter — «Готово», Esc — «Отмена»: как в любой форме Apple. */
  function onKey(event) {
    if (event.key === 'Enter') done();
    if (event.key === 'Escape') cancel();
  }

  // В покое поле показывает запись, в правке — набранное
  const shown = editing ? form : formOf(user);
  const field = (key) => ({
    value: shown[key],
    readOnly: !editing,
    tabIndex: editing ? undefined : -1,
    onChange: (event) => setForm((was) => ({ ...was, [key]: event.target.value })),
    onKeyDown: onKey,
  });

  // Пока цифра в пути — прочерк: он читается как «ещё нет», а не как ноль
  const clubs = stats?.clubs ?? '—';

  // Третий элемент — что открывает «Изменить»: правка входа живёт рядом со значением.
  // Роли в сетке нет: это профиль университета, роль и так видна
  const facts = [
    ['Никнейм', `@${user.username}`, 'nick'],
    ['Почта', user.email, 'email'],
    ['Телефон', formatPhone(user.phone), 'phone'],
    ['Пароль', '••••••••', 'password'],
    ['В Unic с', user.createdAt ? joined.format(new Date(user.createdAt)) : '—'],
    ['Клубы', clubs],
  ];

  return (
    <div className="profile-card__info">
      <div className="profile-card__title">
        {/* Заголовок для скринридера; видимое название — поле, чтобы правка не двигала строку */}
        <h1 className="visually-hidden">{user.fullName}</h1>
        <input
          ref={nameRef}
          className={`profile-edit profile-edit--name${editing ? ' profile-edit--on' : ''}`}
          aria-label="Название"
          {...field('fullName')}
        />

        <div className="profile-card__actions">
          {/* «Отмена» выезжает из ширины строки — и так же уезжает (тот же приём, что у клуба) */}
          <div className={`reveal-x${editing ? ' reveal-x--open' : ''}`}>
            <div className="reveal-x__clip">
              <button
                className="profile-card__action"
                type="button"
                tabIndex={editing ? undefined : -1}
                onClick={cancel}
              >
                Отмена
              </button>
            </div>
          </div>

          <button
            className={`profile-card__action${editing ? ' profile-card__action--primary' : ''}`}
            type="button"
            disabled={saving}
            onClick={editing ? done : start}
          >
            {saving ? 'Сохраняем…' : editing ? 'Готово' : 'Редактировать'}
          </button>
        </div>
      </div>

      <dl className="profile-facts">
        {facts.map(([label, value, kind]) => (
          <div className="profile-facts__item" key={label}>
            <dt className="profile-facts__label">{label}</dt>
            <dd className="profile-facts__row">
              <span className="profile-facts__value" title={String(value)}>
                {value}
              </span>
              {kind && (
                <button
                  className="profile-facts__edit"
                  type="button"
                  aria-label={`Изменить: ${label.toLowerCase()}`}
                  onClick={() => change(kind)}
                >
                  Изменить
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <AccountSecurity open={dialog} session={session} onClose={() => setDialog(null)} />

      {error && (
        <p className="profile__photo-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
