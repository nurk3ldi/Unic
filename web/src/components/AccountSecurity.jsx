import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { formatPhone } from '../people.js';
import Field from './Field.jsx';
import PasswordField from './PasswordField.jsx';
import './AccountSecurity.css';

// Правила — те же, что проверяет сервер (и что при регистрации)
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_HINT = 'Никнейм: 3–20 символов, латинские буквы, цифры и подчёркивание';
const PHONE_RE = /^\+?\d{10,15}$/;
// Номер храним в одном виде — только цифры и ведущий «+», как сервер
const onlyPhoneChars = (value) => value.replace(/[^\d+]/g, '');

const TITLES = { nick: 'Никнейм', email: 'Почта', phone: 'Телефон', password: 'Пароль' };

/**
 * Окно смены ника, почты или пароля. Открывается из «Изменить» рядом со значением
 * в сведениях профиля — как в Apple ID: у каждого значения свой вход в правку.
 * Окно, а не поля на месте: у каждого дела свои поля и шаги, а смена входа требует
 * внимания целиком. Одно окно на три дела — меняется только содержимое.
 *
 * `open` — 'nick' | 'email' | 'phone' | 'password' | null; `session` растёт при каждом открытии:
 * форма монтируется заново чистой, но не при закрытии, пока окно ещё растворяется.
 */
export default function AccountSecurity({ open, session, onClose }) {
  const dialogRef = useRef(null);
  // Окно держит последнее содержимое, пока растворяется, — иначе оно опустело бы раньше окна
  const shown = useRef(null);
  if (open) shown.current = open;

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
      className="modal"
      ref={dialogRef}
      // Событие close приходит задачей позже: если окно уже открыли снова (другое
      // «Изменить»), это эхо прошлого закрытия — его нельзя принимать за новое
      onClose={() => !dialogRef.current?.open && onClose()}
      aria-label={TITLES[shown.current]}
    >
      {shown.current === 'nick' && <NickForm key={session} onDone={onClose} />}
      {shown.current === 'email' && <EmailForm key={session} onDone={onClose} />}
      {shown.current === 'phone' && <PhoneForm key={session} onDone={onClose} />}
      {shown.current === 'password' && <PasswordForm key={session} onDone={onClose} />}
    </dialog>
  );
}

/** Кнопки окна: «Отмена» слева, главное действие справа — как везде в проекте. */
function Actions({ busy, label, busyLabel, onCancel }) {
  return (
    <div className="modal__actions">
      <button className="modal__button" type="button" onClick={onCancel}>
        Отмена
      </button>
      <button className="modal__button modal__button--primary" type="submit" disabled={busy}>
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

/** Ник: одно поле, проверка — сразу при вводе, а не после нажатия. */
function NickForm({ onDone }) {
  const { user, setUser } = useAuth();
  const [value, setValue] = useState(user.username);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const nick = value.trim().toLowerCase();

  async function submit(event) {
    event.preventDefault();
    if (nick === user.username) return onDone(); // ничего не менялось — запроса нет
    if (!USERNAME_RE.test(nick)) return setError(USERNAME_HINT);

    setBusy(true);
    try {
      const { user: saved } = await api.updateMe({ username: nick });
      setUser(saved);
      onDone();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal__form" onSubmit={submit} noValidate>
      <h2 className="modal__title">Никнейм</h2>
      <p className="security__text">По нему вас находят и добавляют в клубы.</p>

      <Field
        label="Никнейм"
        value={value}
        error={error}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          const clean = next.trim().toLowerCase();
          // Ошибка — пока набирают, но только когда правило уже нарушено окончательно
          setError(clean && !/^[a-z0-9_]*$/i.test(clean) ? USERNAME_HINT : '');
        }}
      />

      <Actions busy={busy} label="Сохранить" busyLabel="Сохраняем…" onCancel={onDone} />
    </form>
  );
}

/**
 * Номер: одно поле. Без кода по СМС — отправлять его нечем, а войти по номеру
 * нельзя: он контакт, а не ключ от аккаунта. Проверка — как при регистрации.
 */
function PhoneForm({ onDone }) {
  const { user, setUser } = useAuth();
  const [value, setValue] = useState(formatPhone(user.phone));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const phone = onlyPhoneChars(value);

  async function submit(event) {
    event.preventDefault();
    if (phone === user.phone) return onDone(); // ничего не менялось — запроса нет
    if (!PHONE_RE.test(phone)) return setError('Некорректный номер телефона');

    setBusy(true);
    try {
      const { user: saved } = await api.updateMe({ phone });
      setUser(saved);
      onDone();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="modal__form" onSubmit={submit} noValidate>
      <h2 className="modal__title">Телефон</h2>
      <p className="security__text">Номер видят участники клубов в чате.</p>

      <Field
        label="Номер телефона"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        error={error}
        onChange={(event) => {
          setValue(event.target.value);
          setError('');
        }}
        // Проверка при уходе с поля (§4.7 — inline, а не после отправки)
        onBlur={() => phone && !PHONE_RE.test(phone) && setError('Некорректный номер телефона')}
      />

      <Actions busy={busy} label="Сохранить" busyLabel="Сохраняем…" onCancel={onDone} />
    </form>
  );
}

/** Пароль: текущий, новый и повтор. Совпадение проверяется до отправки. */
function PasswordForm({ onDone }) {
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key) => (event) => {
    setForm((was) => ({ ...was, [key]: event.target.value }));
    setErrors((was) => ({ ...was, [key]: '' }));
  };

  // Проверка при уходе с поля (§4.7 — inline, а не после отправки)
  const checkNext = () =>
    form.next &&
    form.next.length < 8 &&
    setErrors((was) => ({ ...was, next: 'Минимум 8 символов' }));
  const checkRepeat = () =>
    form.repeat &&
    form.repeat !== form.next &&
    setErrors((was) => ({ ...was, repeat: 'Пароли не совпадают' }));

  async function submit(event) {
    event.preventDefault();

    const found = {};
    if (!form.current) found.current = 'Введите текущий пароль';
    if (form.next.length < 8) found.next = 'Минимум 8 символов';
    if (form.repeat !== form.next) found.repeat = 'Пароли не совпадают';
    if (Object.keys(found).length) return setErrors(found);

    setBusy(true);
    try {
      await api.changePassword({ current: form.current, next: form.next });
      setDone(true);
    } catch (failure) {
      // Сервер ругается либо на текущий пароль, либо на новый — показываем у нужного поля
      const onCurrent = /текущ/i.test(failure.message);
      setErrors({ [onCurrent ? 'current' : 'next']: failure.message });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="modal__form">
        <h2 className="modal__title">Пароль изменён</h2>
        <p className="security__text">Теперь входите с новым паролем.</p>
        <div className="modal__actions">
          <button className="modal__button modal__button--primary" type="button" onClick={onDone}>
            Готово
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="modal__form" onSubmit={submit} noValidate>
      <h2 className="modal__title">Пароль</h2>

      <PasswordField
        label="Текущий пароль"
        autoComplete="current-password"
        value={form.current}
        error={errors.current}
        onChange={set('current')}
      />
      <PasswordField
        label="Новый пароль"
        autoComplete="new-password"
        value={form.next}
        error={errors.next}
        onChange={set('next')}
        onBlur={checkNext}
      />
      <PasswordField
        label="Повторите пароль"
        autoComplete="new-password"
        value={form.repeat}
        error={errors.repeat}
        onChange={set('repeat')}
        onBlur={checkRepeat}
      />

      <Actions busy={busy} label="Изменить" busyLabel="Меняем…" onCancel={onDone} />
    </form>
  );
}

/**
 * Почта в два шага: новый адрес и пароль → код, пришедший на новый адрес.
 * Код доказывает, что адрес ваш: на него потом придёт и восстановление пароля.
 */
function EmailForm({ onDone }) {
  const { setUser } = useAuth();
  const [step, setStep] = useState('address'); // 'address' | 'code'
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => {
    setForm((was) => ({ ...was, [key]: event.target.value }));
    setErrors((was) => ({ ...was, [key]: '' }));
  };

  const checkEmail = () =>
    form.email &&
    !EMAIL_RE.test(form.email.trim()) &&
    setErrors((was) => ({ ...was, email: 'Некорректный адрес почты' }));

  async function sendCode(event) {
    event.preventDefault();

    const found = {};
    if (!EMAIL_RE.test(form.email.trim())) found.email = 'Некорректный адрес почты';
    if (!form.password) found.password = 'Введите пароль';
    if (Object.keys(found).length) return setErrors(found);

    setBusy(true);
    try {
      await api.startEmailChange({ email: form.email.trim(), password: form.password });
      setStep('code');
      setErrors({});
    } catch (failure) {
      const onPassword = /пароль/i.test(failure.message);
      setErrors({ [onPassword ? 'password' : 'email']: failure.message });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(form.code.trim())) return setErrors({ code: 'Код — 6 цифр из письма' });

    setBusy(true);
    try {
      const { user: saved } = await api.confirmEmailChange(form.code.trim());
      setUser(saved);
      onDone();
    } catch (failure) {
      setErrors({ code: failure.message });
    } finally {
      setBusy(false);
    }
  }

  if (step === 'code') {
    return (
      <form className="modal__form" onSubmit={confirm} noValidate>
        <h2 className="modal__title">Код из письма</h2>
        <p className="security__text">
          Мы отправили 6 цифр на <strong>{form.email.trim().toLowerCase()}</strong>. Код действует
          10 минут.
        </p>

        <Field
          label="Код"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={form.code}
          error={errors.code}
          onChange={set('code')}
          autoFocus
        />

        {/* Ошиблись адресом — возвращаются к нему, а не начинают окно заново */}
        <button className="security__link" type="button" onClick={() => setStep('address')}>
          Изменить адрес
        </button>

        <Actions busy={busy} label="Подтвердить" busyLabel="Проверяем…" onCancel={onDone} />
      </form>
    );
  }

  return (
    <form className="modal__form" onSubmit={sendCode} noValidate>
      <h2 className="modal__title">Почта</h2>
      <p className="security__text">На новый адрес придёт код — так мы убедимся, что он ваш.</p>

      <Field
        label="Новая почта"
        type="email"
        autoComplete="email"
        value={form.email}
        error={errors.email}
        onChange={set('email')}
        onBlur={checkEmail}
      />
      <PasswordField
        label="Текущий пароль"
        autoComplete="current-password"
        value={form.password}
        error={errors.password}
        onChange={set('password')}
      />

      <Actions busy={busy} label="Отправить код" busyLabel="Отправляем…" onCancel={onDone} />
    </form>
  );
}
