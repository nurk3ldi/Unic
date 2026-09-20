import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import AuthCard from '../components/AuthCard.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import './Auth.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;
const PHONE_RE = /^\+?\d{10,15}$/;

const onlyPhoneChars = (value) => value.replace(/[^\d+]/g, '');

// Те же правила, что и на сервере, — чтобы подсказка совпадала с ответом
const validators = {
  fullName: (v) => (v.trim().replace(/\s+/g, ' ').split(' ').length < 2 ? 'Укажите фамилию и имя' : ''),
  username: (v) =>
    USERNAME_RE.test(v.trim())
      ? ''
      : 'Никнейм: 3–20 символов, латинские буквы, цифры и подчёркивание',
  phone: (v) => (PHONE_RE.test(onlyPhoneChars(v)) ? '' : 'Некорректный номер телефона'),
  email: (v) => (EMAIL_RE.test(v.trim()) ? '' : 'Некорректный адрес почты'),
  password: (v) => (v.length < 8 ? 'Минимум 8 символов' : ''),
};

const EMPTY = { fullName: '', username: '', phone: '', email: '', password: '' };

export default function Register() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);

  const update = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' })); // ошибка уходит, как только правишь поле
    setFormError('');
  };

  // Проверка по месту: подсказываем, когда пользователь ушёл из поля
  const check = (field) => (event) =>
    setErrors((prev) => ({ ...prev, [field]: validators[field](event.target.value) }));

  async function handleSubmit(event) {
    event.preventDefault();

    const next = Object.fromEntries(
      Object.entries(validators).map(([field, run]) => [field, run(values[field])]),
    );
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    setFormError('');
    try {
      await api.register({
        fullName: values.fullName.trim(),
        username: values.username.trim().toLowerCase(),
        phone: onlyPhoneChars(values.phone),
        email: values.email.trim(),
        password: values.password,
      });
      setCreated(true);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Создать аккаунт"
      footer={
        <>
          Уже есть аккаунт? <Link to="/">Войти</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="auth-alert" role="alert">
            {formError}
          </p>
        )}

        {created && (
          <p className="auth-alert auth-alert--ok" role="status">
            Аккаунт успешно создан
          </p>
        )}

        <Field
          label="ФИО"
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          error={errors.fullName}
          onChange={update('fullName')}
          onBlur={check('fullName')}
        />

        <Field
          label="Никнейм"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck="false"
          value={values.username}
          error={errors.username}
          onChange={update('username')}
          onBlur={check('username')}
        />

        <Field
          label="Номер телефона"
          type="tel"
          name="phone"
          autoComplete="tel"
          value={values.phone}
          error={errors.phone}
          onChange={update('phone')}
          onBlur={check('phone')}
        />

        <Field
          label="Почта"
          type="email"
          name="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={update('email')}
          onBlur={check('email')}
        />

        <PasswordField
          name="password"
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          onChange={update('password')}
          onBlur={check('password')}
        />

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? <span className="auth-spinner" aria-hidden="true" /> : 'Зарегистрироваться'}
          {busy && <span className="visually-hidden">Создаём аккаунт</span>}
        </button>
      </form>
    </AuthCard>
  );
}
