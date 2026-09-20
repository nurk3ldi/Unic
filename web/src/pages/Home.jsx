import { IoLogOutOutline } from 'react-icons/io5';
import { useAuth } from '../AuthContext.jsx';
import './Home.css';

/** Главный экран. Пока пустой — наполним на следующем шаге. */
export default function Home() {
  const { signOut } = useAuth();

  return (
    <main className="home">
      <button className="home__signout" type="button" onClick={signOut}>
        <IoLogOutOutline className="home__signout-icon" aria-hidden="true" />
        Выйти
      </button>
    </main>
  );
}
