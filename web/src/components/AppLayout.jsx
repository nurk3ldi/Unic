import { Outlet } from 'react-router-dom';
import ChatNotifier from './ChatNotifier.jsx';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import './AppLayout.css';

/**
 * Общий каркас внутренних экранов: полоса с поиском и панель разделов одни на
 * все страницы, уведомления — тоже. Высота, которая остаётся странице, лежит
 * в `--screen` — считать «минус шапка» в каждом файле не нужно.
 */
export default function AppLayout() {
  return (
    <div className="app">
      <Header />
      <Sidebar />

      {/* Прокручивается содержимое, а не окно: панель остаётся на месте сама,
          без sticky и без того, чтобы страница считала её высоту */}
      <div className="app__content">
        <Outlet />
      </div>

      <ChatNotifier />
    </div>
  );
}
