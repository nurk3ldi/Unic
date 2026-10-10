import logo from '../assets/logo.png';
import './AuthCard.css';

/** Общий каркас экранов входа и регистрации. */
export default function AuthCard({ title, subtitle, children, footer, signature }) {
  return (
    <main className="auth">
      <section className="auth__card">
        <img className="auth__logo" src={logo} alt="Unic" width="150" />
        <h1 className={`auth__title${subtitle ? ' auth__title--with-subtitle' : ''}`}>{title}</h1>
        {subtitle && <p className="auth__subtitle">{subtitle}</p>}

        {children}

        {footer && <p className="auth__footer">{footer}</p>}
      </section>
      {/* Подпись внизу экрана, как «from Meta» у Instagram — только на телефоне */}
      {signature && <p className="auth__signature">{signature}</p>}
    </main>
  );
}
