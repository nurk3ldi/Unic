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

router.get('/', requireAuth, async (_req, res) => {
  const { rows } = await query('select * from clubs order by created_at');
  res.json({ clubs: rows.map(publicClub) });
});

// Создавать клубы может университет; студенческие заявки добавим отдельно
router.post('/', requireAuth, requireRole('university', 'admin'), async (req, res) => {
  const name = String(req.body?.name ?? '').trim().replace(/\s+/g, ' ');

  if (name.length < 2) {
    return res.status(400).json({ error: 'Укажите название клуба' });
  }

  const { rows } = await query(
    `insert into clubs (name, created_by)
     values ($1, $2)
     returning *`,
    [name, req.user.id],
  );

  res.status(201).json({ club: publicClub(rows[0]) });
});

export default router;
