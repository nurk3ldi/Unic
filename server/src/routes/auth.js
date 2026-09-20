import { Router } from 'express';
import { query } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  cookieOptions,
  COOKIE_NAME,
} from '../auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  role: u.role,
  createdAt: u.created_at,
});

router.post('/register', async (req, res) => {
  const fullName = String(req.body?.fullName ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (fullName.length < 2) return res.status(400).json({ error: 'Укажите имя и фамилию' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Некорректный адрес почты' });
  if (password.length < 8) return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });

  const exists = await query('select 1 from users where email = $1', [email]);
  if (exists.rowCount) return res.status(409).json({ error: 'Пользователь с такой почтой уже существует' });

  // Роль назначается системой, а не клиентом: новый аккаунт — всегда студент.
  const { rows } = await query(
    `insert into users (email, password_hash, full_name, role)
     values ($1, $2, $3, 'student')
     returning id, email, full_name, role, created_at`,
    [email, await hashPassword(password), fullName],
  );

  res.cookie(COOKIE_NAME, signToken(rows[0]), cookieOptions);
  res.status(201).json({ user: publicUser(rows[0]) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const { rows } = await query('select * from users where email = $1', [email]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Неверная почта или пароль' });
  }

  res.cookie(COOKIE_NAME, signToken(user), cookieOptions);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
