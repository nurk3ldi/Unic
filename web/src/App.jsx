import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Restore from './pages/Restore.jsx';

export default function App() {
  const { user, ready } = useAuth();

  // Пока сессия не проверена, не показываем ни вход, ни кабинет — иначе экран мигает
  if (!ready) return null;

  // Вошедшему незачем видеть экраны входа, гостю — главный
  const guestOnly = (element) => (user ? <Navigate to="/" replace /> : element);

  return (
    <Routes>
      <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={guestOnly(<Login />)} />
      <Route path="/register" element={guestOnly(<Register />)} />
      <Route path="/restore" element={guestOnly(<Restore />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
