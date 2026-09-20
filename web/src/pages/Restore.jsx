import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import AuthCard from '../components/AuthCard.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import './Auth.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

const TITLES = {
  email: 'Восстановление пароля',
  code: 'Введите код',
  password: 'Новый пароль',
  done: 'Пароль изменён',
};

export default function Restore() {
  const navigate = useNavigate();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);

  // Обратный отсчёт до повторной отправки
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await api.forgot({ email: email.trim() });
      setStep('code');
      setLeft(RESEND_SECONDS);
    });

  function handleSubmit(event) {
    event.preventDefault();

    if (step === 'email') {
      if (!EMAIL_RE.test(email.trim())) return setError('Некорректный адрес почты');
      return sendCode();
    }

    if (step === 'code') {
      if (code.trim().length !== 6) return setError('Код состоит из 6 цифр');
      return run(async () => {
        await api.verifyCode({ email: email.trim(), code: code.trim() });
        setStep('password');
      });
    }

    if (step === 'password') {
      if (password.length < 8) return setError('Минимум 8 символов');
      return run(async () => {
        await api.reset({ email: email.trim(), code: code.trim(), password });
        setStep('done');
      });
    }

    return navigate('/');
  }

  const submitLabel = {
    email: 'Отправить код',
    code: 'Подтвердить',
    password: 'Сохранить пароль',
    done: 'Войти',
  }[step];

  return (
    <AuthCard
      title={TITLES[step]}
      subtitle={
        step === 'email'
          ? 'Укажите почту — отправим код для восстановления'
          : step === 'code'
            ? `Код отправлен на ${email.trim()}`
            : step === 'password'
              ? 'Придумайте новый пароль для входа'
              : 'Теперь можно войти с новым паролем'
      }
      footer={
        step === 'done' ? null : (
          <>
            Вспомнили пароль? <Link to="/" viewTransition>Войти</Link>
          </>
        )
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        )}

        {step === 'email' && (
          <Field
            label="Почта"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
          />
        )}

        {step === 'code' && (
          <>
            <Field
              className="auth-code"
              label="Код из письма"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
            />

            <button
              className="auth-plain"
              type="button"
              disabled={left > 0 || busy}
              onClick={sendCode}
            >
              {left > 0 ? `Отправить ещё раз через ${left} с` : 'Отправить код ещё раз'}
            </button>
          </>
        )}

        {step === 'password' && (
          <PasswordField
            label="Новый пароль"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
        )}

        <button className="auth-submit" type="submit" disabled={busy}>
          <span className="auth-submit__label" key={busy ? 'busy' : step}>
            {busy ? <span className="auth-spinner" aria-hidden="true" /> : submitLabel}
          </span>
        </button>
      </form>
    </AuthCard>
  );
}
