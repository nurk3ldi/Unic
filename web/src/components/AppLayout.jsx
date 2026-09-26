import { Outlet } from 'react-router-dom';
import ChatNotifier from './ChatNotifier.jsx';
import Header from './Header.jsx';

/** Общий каркас внутренних экранов: шапка одна на все страницы, уведомления — тоже. */
export default function AppLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <ChatNotifier />
    </>
  );
}
