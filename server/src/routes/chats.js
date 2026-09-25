import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Те же роли, что управляют клубами, читают и их чаты
const MANAGE_ROLES = ['university', 'admin'];

/**
 * Чаты, которые у человека есть: по одному на клуб — чат заводится вместе
 * с клубом и отдельного создания не требует.
 *
 * Кому какие: участнику — его клубы, университету и админу — все. Список
 * повторяет право читать чат, а не состав: иначе созданный только что клуб
 * не показался бы тому, кто его создал.
 */
router.get('/', requireAuth, async (req, res) => {
  const all = MANAGE_ROLES.includes(req.user.role);

  const { rows } = await query(
    `select c.id, c.name, c.photo_url, m.body, m.has_photo, m.created_at, u.full_name
       from clubs c
       -- lateral: последнее сообщение каждого клуба одним проходом
       left join lateral (
         select body, photo is not null as has_photo, created_at, author_id
           from club_messages
          where club_id = c.id
          order by created_at desc
          limit 1
       ) m on true
       left join users u on u.id = m.author_id
      where $2 or exists (
        select 1 from club_members cm
         where cm.club_id = c.id and cm.user_id = $1 and cm.status = 'active'
      )
      -- сверху то, где говорили последним; в пустых чатах — по дате клуба
      order by coalesce(m.created_at, c.created_at) desc`,
    [req.user.id, all],
  );

  res.json({
    chats: rows.map((row) => ({
      id: row.id,
      name: row.name,
      photo: row.photo_url,
      // Фото без подписи — тоже сообщение: проверяем время, а не текст
      last: row.created_at
        ? {
            text: row.body,
            photo: row.has_photo,
            author: row.full_name ?? 'Удалённый участник',
            createdAt: row.created_at,
          }
        : null,
    })),
  });
});

export default router;
