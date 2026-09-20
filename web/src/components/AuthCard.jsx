import logo from '../assets/logo.png';
import './AuthCard.css';

/** Общий каркас экранов входа и регистрации. */
export default function AuthCard({ title, children, footer }) {
  return (
    <main className="auth">
      <section className="auth__card">
        <img className="auth__logo" src={logo} alt="Unic" width="150" />
        <h1 className="auth__title">{title}</h1>

        {children}

        {footer && <p className="auth__footer">{footer}</p>}
      </section>
    </main>
  );
}
