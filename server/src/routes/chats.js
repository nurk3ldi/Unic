import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Чаты, которые у человека есть: по одному на клуб, где он состоит.
 *
 * Управляющие роли могут открыть чат любого клуба со страницы клуба, но в этот
 * список он не попадает: список отвечает на вопрос «где я переписываюсь»,
 * а не «куда я имею доступ».
 */
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `select c.id, c.name, c.photo_url, m.body, m.created_at, u.full_name
       from club_members cm
       join clubs c on c.id = cm.club_id
       -- lateral: последнее сообщение каждого клуба одним проходом
       left join lateral (
         select body, created_at, author_id
           from club_messages
          where club_id = c.id
          order by created_at desc
          limit 1
       ) m on true
       left join users u on u.id = m.author_id
      where cm.user_id = $1 and cm.status = 'active'
      -- сверху то, где говорили последним; в пустых чатах — по дате клуба
      order by coalesce(m.created_at, c.created_at) desc`,
    [req.user.id],
  );

  res.json({
    chats: rows.map((row) => ({
      id: row.id,
      name: row.name,
      photo: row.photo_url,
      last: row.body
        ? {
            text: row.body,
            author: row.full_name ?? 'Удалённый участник',
            createdAt: row.created_at,
          }
        : null,
    })),
  });
});

export default router;
