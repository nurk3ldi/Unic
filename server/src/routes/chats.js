import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { unreadCount } from '../reads.js';
import { canRead } from '../rooms.js';

const router = Router();

// Те же роли, что управляют клубами, читают и их чаты
const MANAGE_ROLES = ['university', 'admin'];

/**
 * Как чат называется для этого человека. У клуба — имя и снимок клуба. У личного
 * чата — собеседник: тому, кто написал клубу, виден клуб; руководителю клуба —
 * написавший (и `via`: какому клубу писали); в разговоре двоих — второй.
 */
function titleOf(row, userId) {
  if (!row.direct_user_id) return { name: row.name, photo: row.photo_url, direct: false, via: null };

  const person = (id, name, hasPhoto) => ({
    name: name ?? 'Удалённый участник',
    photo: hasPhoto ? `/api/users/${id}/photo` : null,
  });
  const mine = row.direct_user_id === userId;

  if (row.direct_club_id) {
    return mine
      ? { name: row.to_club_name, photo: row.to_club_photo, direct: true, via: null }
      : { ...person(row.du_id, row.du_name, row.du_has_photo), direct: true, via: row.to_club_name };
  }
  return {
    ...(mine
      ? person(row.pu_id, row.pu_name, row.pu_has_photo)
      : person(row.du_id, row.du_name, row.du_has_photo)),
    direct: true,
    via: null,
  };
}

/**
 * Чаты, которые у человека есть: по одному на клуб — чат заводится вместе
 * с клубом и отдельного создания не требует — и личные (ответы на истории).
 *
 * Кому какие: участнику — его клубы, университету и админу — все. Список
 * повторяет право читать чат, а не состав: иначе созданный только что клуб
 * не показался бы тому, кто его создал.
 */
router.get('/', requireAuth, async (req, res) => {
  const all = MANAGE_ROLES.includes(req.user.role);

  const { rows } = await query(
    `select c.id, c.name, c.photo_url, m.id as last_id, m.author_id, m.body, m.has_photo,
            m.file_kind, m.file_name, m.deleted, m.created_at, u.full_name,
            ${unreadCount('$1', 'c.id')} as unread,
            -- Тот же разбор, что подсвечивает ленту (MENTION_RE в web/src/chat.js):
            -- слева не буква, не «@» и не точка, справа граница по латинице
            m.body ~* ('(^|[^a-z0-9_@.])@' || $3 || '([^a-z0-9_]|$)') as mentioned,
            exists (
              select 1 from chat_mutes mu where mu.club_id = c.id and mu.user_id = $1
            ) as muted,
            pc.pinned_at,
            -- Личный чат: с кем он. Название и снимок берутся у собеседника
            c.direct_user_id, c.direct_club_id,
            dc.name as to_club_name, dc.photo_url as to_club_photo,
            du.id as du_id, du.full_name as du_name, du.photo is not null as du_has_photo,
            pu.id as pu_id, pu.full_name as pu_name, pu.photo is not null as pu_has_photo
       from clubs c
       left join pinned_chats pc on pc.club_id = c.id and pc.user_id = $1
       left join clubs dc on dc.id = c.direct_club_id
       left join users du on du.id = c.direct_user_id
       left join users pu on pu.id = c.direct_peer_id
       -- lateral: последнее сообщение каждого клуба одним проходом
       left join lateral (
         select cm.id, cm.body, cm.photo is not null as has_photo, cm.created_at, cm.author_id,
                f.kind as file_kind, f.name as file_name, cm.deleted_at is not null as deleted
           from club_messages cm
           left join chat_files f on f.id = cm.file_id
          where cm.club_id = c.id
          order by cm.created_at desc
          limit 1
       ) m on true
       left join users u on u.id = m.author_id
      where ${canRead('$1', '$2')}
      -- сверху то, где говорили последним; в пустых чатах — по дате клуба
      order by coalesce(m.created_at, c.created_at) desc`,
    [req.user.id, all, req.user.username],
  );

  res.json({
    chats: rows.map((row) => ({
      id: row.id,
      ...titleOf(row, req.user.id),
      // Уведомления выключены — по ним молчит и системное оповещение
      muted: row.muted,
      // Закреплён ли у этого человека и когда: список наверху колонки сортирует сам,
      // порядок здесь прежний — страница чатов его не меняет
      pinnedAt: row.pinned_at,
      // Сколько чужих сообщений новее отметки «прочитано»
      unread: row.unread,
      // Фото без подписи — тоже сообщение: проверяем время, а не текст.
      // id и автор нужны оповещениям: новое ли это и не своё ли
      last: row.created_at
        ? {
            id: row.last_id,
            authorId: row.author_id,
            text: row.body,
            photo: row.has_photo,
            file: row.file_kind ? { kind: row.file_kind, name: row.file_name } : null,
            deleted: row.deleted,
            // Назвали по нику — оповещение придёт и в выключенном чате
            mentioned: row.mentioned === true,
            author: row.full_name ?? 'Удалённый участник',
            createdAt: row.created_at,
          }
        : null,
    })),
  });
});

/**
 * Сколько непрочитанного во всех чатах человека — для числа у «Чатов» в шапке.
 * Те же чаты, что в списке (право читать), тот же счёт — только одной цифрой,
 * чтобы шапка не тянула весь список с последними сообщениями.
 */
router.get('/unread', requireAuth, async (req, res) => {
  const all = MANAGE_ROLES.includes(req.user.role);
  const { rows } = await query(
    `select coalesce(sum(${unreadCount('$1', 'c.id')}), 0)::int as total
       from clubs c
      where ${canRead('$1', '$2')}`,
    [req.user.id, all],
  );
  res.json({ total: rows[0].total });
});

export default router;
