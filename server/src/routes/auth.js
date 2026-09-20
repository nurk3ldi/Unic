import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { query } from '../db.js';
import { sendResetCode } from '../mailer.js';
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

/* ── Восстановление пароля ─────────────────────────────── */

const CODE_TTL_MS = 10 * 60 * 1000; // код живёт 10 минут
const RESEND_COOLDOWN_MS = 60 * 1000; // не чаще раза в минуту
const MAX_ATTEMPTS = 5;

/** Проверка кода — общая для шага «ввод кода» и шага «новый пароль». */
async function checkCode(email, code) {
  const { rows } = await query('select * from password_resets where email = $1', [email]);
  const row = rows[0];

  if (!row) return { status: 400, error: 'Запросите код заново' };
  if (row.expires_at.getTime() < Date.now()) {
    return { status: 400, error: 'Срок действия кода истёк, запросите новый' };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { status: 429, error: 'Слишком много попыток, запросите новый код' };
  }
  if (!(await verifyPassword(code, row.code_hash))) {
    await query('update password_resets set attempts = attempts + 1 where email = $1', [email]);
    return { status: 400, error: 'Неверный код' };
  }
  return { ok: true };
}

router.post('/forgot', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Некорректный адрес почты' });
  }

  // Ответ всегда одинаковый: есть ли такой аккаунт — приватная информация
  const user = await query('select 1 from users where email = $1', [email]);
  if (!user.rowCount) return res.json({ ok: true });

  const sent = await query('select created_at from password_resets where email = $1', [email]);
  const tooSoon =
    sent.rowCount && Date.now() - sent.rows[0].created_at.getTime() < RESEND_COOLDOWN_MS;
  if (tooSoon) return res.json({ ok: true });

  const code = String(randomInt(100000, 1000000));
  await query(
    `insert into password_resets (email, code_hash, expires_at, attempts, created_at)
     values ($1, $2, $3, 0, now())
     on conflict (email) do update
       set code_hash = $2, expires_at = $3, attempts = 0, created_at = now()`,
    [email, await hashPassword(code), new Date(Date.now() + CODE_TTL_MS)],
  );

  await sendResetCode(email, code);
  res.json({ ok: true });
});

router.post('/verify-code', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const code = String(req.body?.code ?? '').trim();

  const result = await checkCode(email, code);
  if (result.error) return res.status(result.status).json({ error: result.error });

  res.json({ ok: true });
});

router.post('/reset', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const code = String(req.body?.code ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
  }

  // Код проверяем ещё раз: шаг подтверждения можно обойти прямым запросом
  const result = await checkCode(email, code);
  if (result.error) return res.status(result.status).json({ error: result.error });

  await query('update users set password_hash = $1 where email = $2', [
    await hashPassword(password),
    email,
  ]);
  await query('delete from password_resets where email = $1', [email]);

  res.json({ ok: true });
});

export default router;
