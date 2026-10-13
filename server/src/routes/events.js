import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { EVENT_FIELDS, EVENT_VISIBLE, publicEvent } from './clubs.js';

const router = Router();

// Те же роли, что управляют клубами, видят и все мероприятия
const MANAGE_ROLES = ['university', 'admin'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Мероприятия клубов, которые человеку видны: общие — всем, внутренние —
 * участникам клуба, университету и админу — все.
 * Без параметров — ближайшие (с вопросом «что будет»). С ?from=…&to=… —
 * всё в этом промежутке, и прошедшее тоже: календарь показывает месяц целиком.
 */
router.get('/', requireAuth, async (req, res) => {
  const all = MANAGE_ROLES.includes(req.user.role);

  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  const ranged = from && to;
  // Number.isNaN у кривой даты — единственный способ её поймать
  if (ranged && (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))) {
    return res.status(400).json({ error: 'Некорректный промежуток дат' });
  }

  const { rows } = await query(
    `select ${EVENT_FIELDS}, c.id as club_id, c.name as club_name, c.photo_url as club_photo
       from club_events e
       join clubs c on c.id = e.club_id
      where ($3::timestamptz is null and e.starts_at >= now()
             or e.starts_at >= $3 and e.starts_at < $4)
        and ${EVENT_VISIBLE}
      order by e.starts_at`,
    [req.user.id, all, ranged ? from.toISOString() : null, ranged ? to.toISOString() : null],
  );

  res.json({
    events: rows.map((row) => ({
      ...publicEvent(row),
      club: { id: row.club_id, name: row.club_name, photo: row.club_photo },
    })),
  });
});

/**
 * Клубы, которым этот человек может добавить событие: университету и админу —
 * любой, лидеру — свои. Пустой список значит «кнопки нет».
 */
router.get('/targets', requireAuth, async (req, res) => {
  const { rows } = await query(
    `select c.id, c.name
       from clubs c
      where c.direct_user_id is null
        and ($2 or exists (
          select 1 from club_members cm
           where cm.club_id = c.id and cm.user_id = $1
             and cm.role = 'lead' and cm.status = 'active'
        ))
      order by c.name`,
    [req.user.id, MANAGE_ROLES.includes(req.user.role)],
  );

  res.json({ clubs: rows });
});

/**
 * Обложка события — отдельным адресом, как аватар (routes/users.js): в списках
 * едет только ссылка. Видит её тот же, кто видит само событие. Кэш на пять
 * минут: событие позже могут начать править, «навсегда» тут не годится.
 */
router.get('/:id/photo', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Фото не найдено' });

  const { rows } = await query(
    `select e.photo from club_events e
      where e.id = $3 and e.photo is not null and ${EVENT_VISIBLE}`,
    [req.user.id, MANAGE_ROLES.includes(req.user.role), id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Фото не найдено' });

  // data:image/jpeg;base64,<данные> — тип до «;», данные после «,»
  const { photo } = rows[0];
  res
    .set('Cache-Control', 'private, max-age=300')
    .type(photo.slice('data:'.length, photo.indexOf(';')))
    .send(Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64'));
});

export default router;
