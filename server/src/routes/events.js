import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Те же роли, что управляют клубами, видят и все мероприятия
const MANAGE_ROLES = ['university', 'admin'];

/**
 * Мероприятия клубов, которые человеку видны: участнику — его клубы,
 * университету и админу — все.
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
    `select e.id, e.title, e.place, e.starts_at, c.id as club_id, c.name as club_name,
            c.photo_url as club_photo
       from club_events e
       join clubs c on c.id = e.club_id
      where ($3::timestamptz is null and e.starts_at >= now()
             or e.starts_at >= $3 and e.starts_at < $4)
        and ($2 or exists (
          select 1 from club_members cm
           where cm.club_id = c.id and cm.user_id = $1 and cm.status = 'active'
        ))
      order by e.starts_at`,
    [req.user.id, all, ranged ? from.toISOString() : null, ranged ? to.toISOString() : null],
  );

  res.json({
    events: rows.map((row) => ({
      id: row.id,
      title: row.title,
      place: row.place,
      startsAt: row.starts_at,
      club: { id: row.club_id, name: row.club_name, photo: row.club_photo },
    })),
  });
});

export default router;
