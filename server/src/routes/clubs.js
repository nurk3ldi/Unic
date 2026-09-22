import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const publicClub = (row) => ({
  id: row.id,
  name: row.name,
  photo: row.photo_url,
  status: row.status,
  members: 0, // появится вместе с таблицей участников
  createdAt: row.created_at,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', requireAuth, async (_req, res) => {
  const { rows } = await query('select * from clubs order by created_at');
  res.json({ clubs: rows.map(publicClub) });
});

router.get('/:id', requireAuth, async (req, res) => {
  // Без проверки Postgres ответит ошибкой синтаксиса на «кривом» id
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const { rows } = await query('select * from clubs where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Клуб не найден' });

  res.json({ club: publicClub(rows[0]) });
});

// Создавать клубы может университет; студенческие заявки добавим отдельно
// Фото приходит строкой data URL: клиент уже ужал его до квадрата 400×400
const PHOTO_LIMIT = 700_000;

router.post('/', requireAuth, requireRole('university', 'admin'), async (req, res) => {
  const name = String(req.body?.name ?? '').trim().replace(/\s+/g, ' ');
  const photo = req.body?.photo ? String(req.body.photo) : null;

  if (name.length < 2) {
    return res.status(400).json({ error: 'Укажите название клуба' });
  }
  if (photo && !photo.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Некорректный формат изображения' });
  }
  if (photo && photo.length > PHOTO_LIMIT) {
    return res.status(400).json({ error: 'Изображение слишком большое' });
  }

  const { rows } = await query(
    `insert into clubs (name, photo_url, created_by)
     values ($1, $2, $3)
     returning *`,
    [name, photo, req.user.id],
  );

  res.status(201).json({ club: publicClub(rows[0]) });
});

export default router;
