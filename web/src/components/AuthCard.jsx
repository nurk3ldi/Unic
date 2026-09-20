import logo from '../assets/logo.png';
import './AuthCard.css';

/** Общий каркас экранов входа и регистрации. */
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <main className="auth">
      <section className="auth__card">
        <img className="auth__logo" src={logo} alt="Unic" width="150" />
        <h1 className={`auth__title${subtitle ? ' auth__title--with-subtitle' : ''}`}>{title}</h1>
        {subtitle && <p className="auth__subtitle">{subtitle}</p>}

        {children}

        {footer && <p className="auth__footer">{footer}</p>}
      </section>
    </main>
  );
}
