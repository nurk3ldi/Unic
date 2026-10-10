import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import Chats from './pages/Chats.jsx';
import ClubPage from './pages/ClubPage.jsx';
import Clubs from './pages/Clubs.jsx';
import Create from './pages/Create.jsx';
import CreatePost from './pages/CreatePost.jsx';
import Events from './pages/Events.jsx';
import Home from './pages/Home.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Register from './pages/Register.jsx';
import Restore from './pages/Restore.jsx';

export default function App() {
  const { user, ready } = useAuth();
  const { pathname } = useLocation();

  // Пока сессия не проверена, не показываем ни вход, ни кабинет — иначе экран мигает
  if (!ready) return null;

  // Вошедшему незачем видеть экраны входа, гостю — главный
  const guestOnly = (element) => (user ? <Navigate to="/" replace /> : element);

  // Гость на главной видит лендинг, на остальных внутренних экранах — вход
  const guestGate = pathname === '/' ? <Landing /> : <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={user ? <AppLayout /> : guestGate}>
        <Route path="/" element={<Home />} />
        <Route path="/clubs" element={<Clubs />} />
        <Route path="/clubs/:id" element={<ClubPage />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/chats/:id" element={<Chats />} />
        <Route path="/events" element={<Events />} />
        <Route path="/create" element={<Create />} />
        <Route path="/create/post" element={<CreatePost />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="/login" element={guestOnly(<Login />)} />
      <Route path="/register" element={guestOnly(<Register />)} />
      <Route path="/restore" element={guestOnly(<Restore />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
