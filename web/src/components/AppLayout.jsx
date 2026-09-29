import { Outlet } from 'react-router-dom';
import ChatNotifier from './ChatNotifier.jsx';
import Header from './Header.jsx';
import ProfileCard from './ProfileCard.jsx';
import Requests from './Requests.jsx';
import Sidebar from './Sidebar.jsx';
import './AppLayout.css';

/**
 * Общий каркас внутренних экранов: полоса с поиском одна на все страницы,
 * уведомления — тоже. Высота, которая остаётся странице, лежит в `--screen` —
 * считать «минус шапка» в каждом файле не нужно.
 *
 * Панель разделов (`Sidebar`) временно убрана по просьбе: сам компонент и его
 * стили на месте, вернуть — снова отрисовать его здесь и вернуть колонку в сетке.
 */
export default function AppLayout() {
  return (
    <div className="app">
      <Header />

      {/* Левый столбец: визитка и разделы — двумя карточками на общем полотне */}
      <aside className="app__side">
        <ProfileCard />
        <Sidebar />
      </aside>

      {/* Прокручивается содержимое, а не окно: панель остаётся на месте сама,
          без sticky и без того, чтобы страница считала её высоту */}
      <div className="app__content">
        <Outlet />
      </div>

      {/* Правый столбец: пока в нём только заголовок — карточки встанут под ним */}
      <aside className="app__aside">
        <Requests />
      </aside>

      <ChatNotifier />
    </div>
  );
}
