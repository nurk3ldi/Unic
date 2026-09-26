import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Приглашения, которые ждут ответа: какой клуб, кто позвал и что написал.
 * Приглашение — строка состава со status = 'invited', отдельной таблицы нет.
 */
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `select c.id, c.name, c.photo_url, m.note, m.created_at, u.full_name as inviter
       from club_members m
       join clubs c on c.id = m.club_id
       left join users u on u.id = m.invited_by
      where m.user_id = $1 and m.status = 'invited'
      order by m.created_at desc`,
    [req.user.id],
  );

  res.json({
    invites: rows.map((row) => ({
      club: { id: row.id, name: row.name, photo: row.photo_url },
      note: row.note,
      inviter: row.inviter,
      createdAt: row.created_at,
    })),
  });
});

/** Принять: строка приглашения становится участием. */
router.post('/:clubId/accept', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.clubId)) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }
  const { rows } = await query(
    `update club_members set status = 'active', note = null
      where club_id = $1 and user_id = $2 and status = 'invited'
      returning club_id`,
    [req.params.clubId, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Приглашение не найдено' });

  res.json({ ok: true });
});

/** Отклонить: строка просто исчезает — пригласить можно снова. */
router.post('/:clubId/decline', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.clubId)) {
    return res.status(404).json({ error: 'Приглашение не найдено' });
  }
  const { rows } = await query(
    `delete from club_members
      where club_id = $1 and user_id = $2 and status = 'invited'
      returning club_id`,
    [req.params.clubId, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Приглашение не найдено' });

  res.json({ ok: true });
});

export default router;
