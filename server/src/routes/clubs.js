import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const publicClub = (row) => ({
  id: row.id,
  name: row.name,
  photo: row.photo_url,
  description: row.description,
  status: row.status,
  members: 0, // появится вместе с таблицей участников
  createdAt: row.created_at,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Фото приходит строкой data URL: клиент уже ужал его до квадрата 400×400
const PHOTO_LIMIT = 700_000;
const ABOUT_LIMIT = 2000;

/**
 * Проверяет присланные поля и переводит их в названия столбцов.
 * Правила общие для создания и правки, поэтому записаны один раз.
 * Поле, которого нет в теле запроса, в ответ не попадает — при правке
 * это значит «не трогать», а не «стереть».
 */
function readClubFields(body) {
  const fields = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim().replace(/\s+/g, ' ');
    if (name.length < 2) return { error: 'Укажите название клуба' };
    fields.name = name;
  }

  if (body?.photo !== undefined) {
    const photo = body.photo ? String(body.photo) : null;
    if (photo && !photo.startsWith('data:image/')) {
      return { error: 'Некорректный формат изображения' };
    }
    if (photo && photo.length > PHOTO_LIMIT) {
      return { error: 'Изображение слишком большое' };
    }
    fields.photo_url = photo;
  }

  if (body?.description !== undefined) {
    const description = body.description ? String(body.description).trim() : null;
    if (description && description.length > ABOUT_LIMIT) {
      return { error: 'Описание слишком длинное' };
    }
    fields.description = description;
  }

  return { fields };
}

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
router.post('/', requireAuth, requireRole('university', 'admin'), async (req, res) => {
  const { fields, error } = readClubFields(req.body);
  if (error) return res.status(400).json({ error });
  if (!fields.name) return res.status(400).json({ error: 'Укажите название клуба' });

  const { rows } = await query(
    `insert into clubs (name, photo_url, description, created_by)
     values ($1, $2, $3, $4)
     returning *`,
    [fields.name, fields.photo_url ?? null, fields.description ?? null, req.user.id],
  );

  res.status(201).json({ club: publicClub(rows[0]) });
});

router.patch('/:id', requireAuth, requireRole('university', 'admin'), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const { fields, error } = readClubFields(req.body);
  if (error) return res.status(400).json({ error });

  const columns = Object.keys(fields);
  if (!columns.length) return res.status(400).json({ error: 'Нечего сохранять' });

  // Имена столбцов берутся из readClubFields, а не из тела запроса; значения — параметры
  const set = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  const values = [...columns.map((column) => fields[column]), req.params.id];

  const { rows } = await query(
    `update clubs set ${set} where id = $${values.length} returning *`,
    values,
  );
  if (!rows[0]) return res.status(404).json({ error: 'Клуб не найден' });

  res.json({ club: publicClub(rows[0]) });
});

export default router;
