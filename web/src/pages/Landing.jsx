import { Link } from 'react-router-dom';
import './Landing.css';

// Первый экран гостя: пока пустой лист, вход — в правом верхнем углу
export default function Landing() {
  return (
    <main className="landing">
      <h1 className="visually-hidden">Unic</h1>
      <Link to="/login" viewTransition className="landing__login">
        Войти
      </Link>
    </main>
  );
}
