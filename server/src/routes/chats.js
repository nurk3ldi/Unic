import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Те же пределы, что и в клубном чате: правило одно на переписку
const MESSAGE_LIMIT = 2000;
const MESSAGE_PAGE = 50;

const publicMessage = (row) => ({
  id: row.id,
  text: row.body,
  authorId: row.author_id,
  // Автора могли удалить: переписка остаётся, имя заменяется
  author: row.full_name ?? 'Удалённый участник',
  createdAt: row.created_at,
});

/**
 * Чаты, которые у человека есть: общий и по одному на клуб, где он состоит.
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

  const general = await query(
    `select m.body, m.created_at, u.full_name
       from club_messages m
       left join users u on u.id = m.author_id
      where m.club_id is null
      order by m.created_at desc
      limit 1`,
  );

  const last = (row) =>
    row
      ? {
          text: row.body,
          author: row.full_name ?? 'Удалённый участник',
          createdAt: row.created_at,
        }
      : null;

  res.json({
    general: { last: last(general.rows[0]) },
    chats: rows.map((row) => ({
      id: row.id,
      name: row.name,
      photo: row.photo_url,
      last: last(row.body ? row : null),
    })),
  });
});

/**
 * Общий чат университета — сообщения без клуба.
 * Читать и писать может любой вошедший: он затем и общий.
 */
router.get('/general/messages', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || MESSAGE_PAGE, MESSAGE_PAGE);

  const { rows } = await query(
    `select m.id, m.body, m.author_id, m.created_at, u.full_name
       from club_messages m
       left join users u on u.id = m.author_id
      where m.club_id is null
      order by m.created_at desc
      limit $1`,
    [limit],
  );

  res.json({ messages: rows.reverse().map(publicMessage) });
});

router.post('/general/messages', requireAuth, async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Сообщение пустое' });
  if (text.length > MESSAGE_LIMIT) {
    return res.status(400).json({ error: 'Сообщение слишком длинное' });
  }

  const { rows } = await query(
    `insert into club_messages (club_id, author_id, body)
     values (null, $1, $2)
     returning id, body, author_id, created_at`,
    [req.user.id, text],
  );

  res.status(201).json({
    message: publicMessage({ ...rows[0], full_name: req.user.full_name }),
  });
});

export default router;
