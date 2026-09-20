import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import './Auth.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

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
      const { user } = await api.login({ email: email.trim(), password, remember });
      setUser(user);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Добро пожаловать"
      footer={
        <>
          Нет аккаунта? <Link to="/register" viewTransition>Зарегистрироваться</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="auth-alert" role="alert">
            {formError}
          </p>
        )}

        <Field
          label="Почта"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          error={emailError}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError('');
            setFormError('');
          }}
          onBlur={checkEmail}
        />

        <PasswordField
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFormError('');
          }}
        />

        <div className="auth-row">
          <label className="auth-remember">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Запомнить меня
          </label>

          <Link className="auth-link" to="/restore" viewTransition>
            Забыли пароль?
          </Link>
        </div>

        <button className="auth-submit" type="submit" disabled={busy}>
          <span className="auth-submit__label" key={busy ? 'busy' : 'idle'}>
            {busy ? <span className="auth-spinner" aria-hidden="true" /> : 'Войти'}
          </span>
          {busy && <span className="visually-hidden">Выполняется вход</span>}
        </button>
      </form>
    </AuthCard>
  );
}
