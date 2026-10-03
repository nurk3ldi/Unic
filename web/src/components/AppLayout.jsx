import { Outlet, useLocation } from 'react-router-dom';
import ChatNotifier from './ChatNotifier.jsx';
import Header from './Header.jsx';
import AsideChats from './AsideChats.jsx';
import ProfileCard from './ProfileCard.jsx';
import Requests from './Requests.jsx';
import Sidebar from './Sidebar.jsx';
import './AppLayout.css';

/**
 * Общий каркас внутренних экранов: полоса с поиском одна на все страницы,
 * уведомления — тоже. Высота, которая остаётся странице, лежит в `--screen` —
 * считать «минус шапка» в каждом файле не нужно.
 *
 * Правый столбец (приглашения и чаты) — только на главной: к клубам, событиям
 * и профилю он отношения не имеет, там его место отдаётся самой странице.
 */
export default function AppLayout() {
  const home = useLocation().pathname === '/';

  return (
    <div className={home ? 'app app--home' : 'app'}>
      <Header />

      {/* Левый столбец: визитка и разделы */}
      <aside className="app__side">
        <ProfileCard />
        <Sidebar />
      </aside>

      {/* Прокручивается окно; левый столбец прилипает и едет с лентой (AppLayout.css) */}
      <div className="app__content">
        <Outlet />
      </div>

      {/* Правый столбец: то, что ждёт ответа, и переписки под ним */}
      {home && (
        <aside className="app__aside">
          <Requests />
          <AsideChats />
        </aside>
      )}

      <ChatNotifier />
    </div>
  );
}
