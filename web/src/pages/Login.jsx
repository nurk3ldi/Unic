import { useState } from 'react';
import { IoEyeOffOutline, IoEyeOutline } from 'react-icons/io5';
import { api } from '../api.js';
import logo from '../assets/logo.png';
import './Login.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Проверка по месту: подсказываем, когда пользователь ушёл из поля
  const checkEmail = () =>
    setEmailError(!email || EMAIL_RE.test(email.trim()) ? '' : 'Некорректный адрес почты');

  async function handleSubmit(event) {
    event.preventDefault();

    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Некорректный адрес почты');
      return;
    }
    if (!password) {
      setFormError('Введите пароль');
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      await api.login({ email: email.trim(), password });
      setSignedIn(true);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login__card">
        <img className="login__logo" src={logo} alt="Unic" width="150" />

        <h1 className="login__title">Добро пожаловать</h1>

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <p className="login__alert" role="alert">
              {formError}
            </p>
          )}

          {signedIn && (
            <p className="login__alert login__alert--ok" role="status">
              Вход выполнен. Личный кабинет появится на следующем шаге.
            </p>
          )}

          <div className="login__field">
            <label className="login__label" htmlFor="email">
              Почта
            </label>
            <div className={`login__box${emailError ? ' login__box--error' : ''}`}>
              <input
                className="login__input"
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="student@unic.kz"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError('');
                  setFormError('');
                }}
                onBlur={checkEmail}
                aria-invalid={emailError ? 'true' : undefined}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
            </div>
            {emailError && (
              <p className="login__hint login__hint--error" id="email-error">
                {emailError}
              </p>
            )}
          </div>

          <div className="login__field">
            <label className="login__label" htmlFor="password">
              Пароль
            </label>
            <div className="login__box">
              <input
                className="login__input"
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFormError('');
                }}
              />
              <button
                className="login__eye"
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                aria-pressed={showPassword}
              >
                {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
              </button>
            </div>
          </div>

          <a className="login__forgot" href="#restore">
            Забыли пароль?
          </a>

          <button className="login__submit" type="submit" disabled={busy}>
            {busy ? <span className="login__spinner" aria-hidden="true" /> : 'Войти'}
            {busy && <span className="visually-hidden">Выполняется вход</span>}
          </button>
        </form>
      </section>
    </main>
  );
}
