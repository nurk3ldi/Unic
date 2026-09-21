import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';

/** Общий каркас внутренних экранов: шапка одна на все страницы. */
export default function AppLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
