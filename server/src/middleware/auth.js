import { verifyToken, COOKIE_NAME } from '../auth.js';
import { query } from '../db.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Требуется вход в систему' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }

  const { rows } = await query(
    'select id, email, username, phone, full_name, role, created_at from users where id = $1',
    [payload.sub],
  );
  if (!rows[0]) return res.status(401).json({ error: 'Пользователь не найден' });

  req.user = rows[0];
  next();
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ error: 'Недостаточно прав для этого действия' });
