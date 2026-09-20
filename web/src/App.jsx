import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Restore from './pages/Restore.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/restore" element={<Restore />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
