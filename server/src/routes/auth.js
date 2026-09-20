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
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const PHONE_RE = /^\+?\d{10,15}$/;

// Номер храним в одном виде: только цифры и ведущий «+»
const normalizePhone = (value) => String(value).replace(/[^\d+]/g, '');

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  username: u.username,
  phone: u.phone,
  fullName: u.full_name,
  role: u.role,
  createdAt: u.created_at,
});

router.post('/register', async (req, res) => {
  const fullName = String(req.body?.fullName ?? '').trim().replace(/\s+/g, ' ');
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const phone = normalizePhone(req.body?.phone ?? '');
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (fullName.split(' ').length < 2) {
    return res.status(400).json({ error: 'Укажите фамилию и имя' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: 'Никнейм: 3–20 символов, латинские буквы, цифры и подчёркивание',
    });
  }
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Некорректный номер телефона' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Некорректный адрес почты' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
  }

  // Одним запросом узнаём, какое именно поле занято, — чтобы сказать об этом точно
  const taken = await query(
    'select email, username, phone from users where email = $1 or username = $2 or phone = $3',
    [email, username, phone],
  );
  for (const row of taken.rows) {
    if (row.email === email) {
      return res.status(409).json({ error: 'Пользователь с такой почтой уже существует' });
    }
    if (row.username === username) {
      return res.status(409).json({ error: 'Этот никнейм уже занят' });
    }
    if (row.phone === phone) {
      return res.status(409).json({ error: 'Этот номер уже зарегистрирован' });
    }
  }

  // Роль назначается системой, а не клиентом: новый аккаунт — всегда студент.
  const { rows } = await query(
    `insert into users (email, username, phone, password_hash, full_name, role)
     values ($1, $2, $3, $4, $5, 'student')
     returning id, email, username, phone, full_name, role, created_at`,
    [email, username, phone, await hashPassword(password), fullName],
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

  // Без «Запомнить меня» кука становится сеансовой: уходит с закрытием браузера
  const remember = req.body?.remember !== false;
  res.cookie(COOKIE_NAME, signToken(user), {
    ...cookieOptions,
    maxAge: remember ? cookieOptions.maxAge : undefined,
  });
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
