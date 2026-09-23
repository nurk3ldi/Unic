import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const publicClub = (row) => ({
  id: row.id,
  name: row.name,
  photo: row.photo_url,
  description: row.description,
  status: row.status,
  members: row.members ?? 0,
  createdAt: row.created_at,
});

const publicMember = (row) => ({ id: row.id, name: row.full_name, role: row.role });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Фото приходит строкой data URL: клиент уже ужал его до квадрата 400×400
const PHOTO_LIMIT = 700_000;
const ABOUT_LIMIT = 2000;
const STATUSES = ['active', 'pending', 'suspended'];

// Длина сообщения: столько же, сколько у описания клуба — предел один на проект
const MESSAGE_LIMIT = 2000;
// Сколько сообщений отдаём за раз: чат клуба читают с конца
const MESSAGE_PAGE = 50;

// Участниками распоряжаются те же роли, что правят сам клуб
const MANAGE_ROLES = ['university', 'admin'];
const canManage = (user) => MANAGE_ROLES.includes(user.role);

// Счётчик рядом с клубом: заявки в него не входят
const MEMBERS_COUNT = `(select count(*)::int from club_members m
                         where m.club_id = clubs.id and m.status = 'active')`;

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

  if (body?.status !== undefined) {
    const status = String(body.status);
    if (!STATUSES.includes(status)) return { error: 'Неизвестное состояние клуба' };
    fields.status = status;
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

/** Клуб существует? Без проверки Postgres ответит ошибкой синтаксиса на «кривом» id. */
async function findClub(id) {
  if (!UUID_RE.test(id)) return null;
  const { rows } = await query('select id from clubs where id = $1', [id]);
  return rows[0] ?? null;
}

router.get('/', requireAuth, async (_req, res) => {
  const { rows } = await query(
    `select *, ${MEMBERS_COUNT} as members from clubs order by created_at`,
  );
  res.json({ clubs: rows.map(publicClub) });
});

router.get('/:id', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const { rows } = await query(
    `select *, ${MEMBERS_COUNT} as members from clubs where id = $1`,
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Клуб не найден' });

  res.json({ club: publicClub(rows[0]) });
});

// Создавать клубы может университет; студенческие заявки добавим отдельно
router.post('/', requireAuth, requireRole(...MANAGE_ROLES), async (req, res) => {
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

router.patch('/:id', requireAuth, requireRole(...MANAGE_ROLES), async (req, res) => {
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
    `update clubs set ${set} where id = $${values.length}
     returning *, ${MEMBERS_COUNT} as members`,
    values,
  );
  if (!rows[0]) return res.status(404).json({ error: 'Клуб не найден' });

  res.json({ club: publicClub(rows[0]) });
});

/** Удаление клуба. Строки состава уходят каскадом — это правило базы. */
router.delete('/:id', requireAuth, requireRole(...MANAGE_ROLES), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const { rows } = await query('delete from clubs where id = $1 returning id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Клуб не найден' });

  res.json({ ok: true });
});

/**
 * Состав клуба. Руководитель идёт первым — это сортировка запроса,
 * а не порядок, в котором строки легли в таблицу.
 * Список заявок видят только те, кто по ним решает.
 */
router.get('/:id/members', requireAuth, async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const { rows } = await query(
    `select u.id, u.full_name, m.role, m.status
       from club_members m
       join users u on u.id = m.user_id
      where m.club_id = $1
      order by (m.role = 'lead') desc, u.full_name`,
    [req.params.id],
  );

  res.json({
    members: rows.filter((row) => row.status === 'active').map(publicMember),
    requests: canManage(req.user)
      ? rows.filter((row) => row.status === 'pending').map(publicMember)
      : [],
    canManage: canManage(req.user),
  });
});

/** Заявка на вступление — та же строка состава, только со status = 'pending'. */
router.post('/:id/members/request', requireAuth, async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const { rows } = await query(
    `insert into club_members (club_id, user_id, status)
     values ($1, $2, 'pending')
     on conflict (club_id, user_id) do nothing
     returning status`,
    [req.params.id, req.user.id],
  );
  if (!rows[0]) return res.status(409).json({ error: 'Заявка уже отправлена' });

  res.status(201).json({ ok: true });
});

/** Добавление участника вручную: по никнейму или почте. */
router.post('/:id/members', requireAuth, requireRole(...MANAGE_ROLES), async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const login = String(req.body?.username ?? '')
    .trim()
    .toLowerCase();
  if (!login) return res.status(400).json({ error: 'Укажите никнейм или почту' });

  const { rows: found } = await query(
    'select id, full_name from users where username = $1 or email = $1',
    [login],
  );
  if (!found[0]) return res.status(404).json({ error: 'Такого пользователя нет' });

  // Заявка того же человека становится участием — отдельным шагом одобрять нечего
  const { rows } = await query(
    `insert into club_members (club_id, user_id, status)
     values ($1, $2, 'active')
     on conflict (club_id, user_id) do update set status = 'active'
       where club_members.status = 'pending'
     returning *`,
    [req.params.id, found[0].id],
  );
  if (!rows[0]) return res.status(409).json({ error: 'Этот человек уже в клубе' });

  res.status(201).json({ member: publicMember({ ...found[0], role: rows[0].role }) });
});

/** Одобрение заявки и назначение руководителя. */
router.patch(
  '/:id/members/:userId',
  requireAuth,
  requireRole(...MANAGE_ROLES),
  async (req, res) => {
    const { id, userId } = req.params;
    if (!UUID_RE.test(userId) || !(await findClub(id))) {
      return res.status(404).json({ error: 'Клуб не найден' });
    }

    if (req.body?.status === 'active') {
      const { rows } = await query(
        `update club_members set status = 'active'
          where club_id = $1 and user_id = $2 and status = 'pending'
          returning *`,
        [id, userId],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Заявка не найдена' });
      return res.json({ ok: true });
    }

    if (req.body?.role === 'member') {
      const { rows } = await query(
        `update club_members set role = 'member'
          where club_id = $1 and user_id = $2 and role = 'lead'
          returning *`,
        [id, userId],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Руководитель не найден' });
      return res.json({ ok: true });
    }

    if (req.body?.role === 'lead') {
      // Прежнего руководителя нужно снять в той же транзакции: частичный
      // уникальный индекс не даст двум строкам одновременно быть 'lead'
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(
          `update club_members set role = 'member' where club_id = $1 and role = 'lead'`,
          [id],
        );
        const { rows } = await client.query(
          `update club_members set role = 'lead'
            where club_id = $1 and user_id = $2 and status = 'active'
            returning *`,
          [id, userId],
        );
        if (!rows[0]) {
          await client.query('rollback');
          return res.status(404).json({ error: 'Участник не найден' });
        }
        await client.query('commit');
        return res.json({ ok: true });
      } catch (failure) {
        await client.query('rollback');
        throw failure;
      } finally {
        client.release();
      }
    }

    return res.status(400).json({ error: 'Непонятное изменение' });
  },
);

/** Исключение участника и отклонение заявки — одно и то же удаление строки. */
router.delete(
  '/:id/members/:userId',
  requireAuth,
  requireRole(...MANAGE_ROLES),
  async (req, res) => {
    const { id, userId } = req.params;
    if (!UUID_RE.test(userId) || !(await findClub(id))) {
      return res.status(404).json({ error: 'Клуб не найден' });
    }

    const { rows } = await query(
      'delete from club_members where club_id = $1 and user_id = $2 returning user_id',
      [id, userId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Участник не найден' });

    res.json({ ok: true });
  },
);

/** Состоит ли человек в клубе. Те, кто клубом управляет, проходят и без состава. */
async function canReadChat(clubId, user) {
  if (canManage(user)) return true;

  const { rows } = await query(
    `select 1 from club_members
      where club_id = $1 and user_id = $2 and status = 'active'`,
    [clubId, user.id],
  );
  return Boolean(rows[0]);
}

const publicMessage = (row) => ({
  id: row.id,
  text: row.body,
  authorId: row.author_id,
  // Автора могли удалить: переписка остаётся, имя заменяется
  author: row.full_name ?? 'Удалённый участник',
  username: row.username ?? null,
  phone: row.phone ?? null,
  createdAt: row.created_at,
});

/**
 * Лента чата: последние сообщения, в порядке чтения — сверху старые.
 * Клиент опрашивает этот адрес; отдельного «только новое» нет, потому что
 * страница всё равно показывает хвост и сравнивать ей не с чем.
 */
router.get('/:id/messages', requireAuth, async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }
  if (!(await canReadChat(req.params.id, req.user))) {
    return res.status(403).json({ error: 'Чат доступен только участникам клуба' });
  }

  const limit = Math.min(Number(req.query.limit) || MESSAGE_PAGE, MESSAGE_PAGE);

  const { rows } = await query(
    `select m.id, m.body, m.author_id, m.created_at, u.full_name, u.username, u.phone
       from club_messages m
       left join users u on u.id = m.author_id
      where m.club_id = $1
      order by m.created_at desc
      limit $2`,
    [req.params.id, limit],
  );

  res.json({ messages: rows.reverse().map(publicMessage) });
});

router.post('/:id/messages', requireAuth, async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }
  if (!(await canReadChat(req.params.id, req.user))) {
    return res.status(403).json({ error: 'Писать в чат могут только участники клуба' });
  }

  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Сообщение пустое' });
  if (text.length > MESSAGE_LIMIT) {
    return res.status(400).json({ error: 'Сообщение слишком длинное' });
  }

  const { rows } = await query(
    `insert into club_messages (club_id, author_id, body)
     values ($1, $2, $3)
     returning id, body, author_id, created_at`,
    [req.params.id, req.user.id, text],
  );

  res.status(201).json({
    message: publicMessage({
      ...rows[0],
      full_name: req.user.full_name,
      username: req.user.username,
      phone: req.user.phone,
    }),
  });
});

export default router;
