import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  TooLarge,
  classify,
  cleanName,
  filePath,
  rejectAfterBody,
  removeFile,
  saveBody,
} from '../files.js';

const router = Router();

const publicClub = (row) => ({
  id: row.id,
  name: row.name,
  photo: row.photo_url,
  description: row.description,
  status: row.status,
  accepting: row.accepting,
  members: row.members ?? 0,
  createdAt: row.created_at,
});

const publicMember = (row) => ({
  id: row.id,
  name: row.full_name,
  username: row.username ?? null,
  role: row.role,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Фото приходит строкой data URL: клиент уже ужал его до квадрата 400×400
const PHOTO_LIMIT = 700_000;
const ABOUT_LIMIT = 2000;
// Текст к приглашению — пара строк, не письмо
const NOTE_LIMIT = 300;
// Сколько людей показывать в поиске при приглашении
const CANDIDATES_LIMIT = 8;
const STATUSES = ['active', 'pending', 'suspended'];

// Длина сообщения: столько же, сколько у описания клуба — предел один на проект
const MESSAGE_LIMIT = 2000;
// Снимок сжимает браузер (длинная сторона ≤ 1280px), здесь — только проверка.
// Предел ниже 1 MB у express.json: рядом в теле ещё подпись
const CHAT_PHOTO_LIMIT = 900_000;
const PHOTO_SIDE_LIMIT = 4096;
const CHAT_PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
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

  if (body?.accepting !== undefined) {
    if (typeof body.accepting !== 'boolean') return { error: 'Некорректное значение' };
    fields.accepting = body.accepting;
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

/** Цифры для профиля университета. Путь стоит выше /:id, иначе 'stats' ушёл бы в id. */
router.get('/stats', requireAuth, requireRole(...MANAGE_ROLES), async (_req, res) => {
  const { rows } = await query(
    'select count(*)::int as clubs from clubs',
  );
  res.json({ stats: rows[0] });
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

  // Сведения о вложениях уйдут каскадом, а файлы с диска — только если стереть их самим
  const { rows: files } = await query('select id from chat_files where club_id = $1', [
    req.params.id,
  ]);
  const { rows } = await query('delete from clubs where id = $1 returning id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Клуб не найден' });

  await Promise.all(files.map((file) => removeFile(file.id)));
  res.json({ ok: true });
});

/**
 * Состав клуба. Руководитель идёт первым — это сортировка запроса,
 * а не порядок, в котором строки легли в таблицу.
 * Заявки и отправленные приглашения видят только те, кто клубом управляет.
 */
router.get('/:id/members', requireAuth, async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const { rows } = await query(
    `select u.id, u.full_name, u.username, m.role, m.status
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
    invites: canManage(req.user)
      ? rows.filter((row) => row.status === 'invited').map(publicMember)
      : [],
    canManage: canManage(req.user),
  });
});

/**
 * Заявка на вступление — та же строка состава, только со status = 'pending'.
 * Закрытый для заявок клуб отказывает здесь же: скрытой кнопки мало.
 */
router.post('/:id/members/request', requireAuth, async (req, res) => {
  const club = UUID_RE.test(req.params.id)
    ? (await query('select accepting from clubs where id = $1', [req.params.id])).rows[0]
    : null;
  if (!club) return res.status(404).json({ error: 'Клуб не найден' });
  if (!club.accepting) {
    return res.status(403).json({ error: 'Клуб сейчас не принимает заявки' });
  }

  // Если клуб уже пригласил — заявка и есть согласие: человек сразу в клубе
  const { rows } = await query(
    `insert into club_members (club_id, user_id, status)
     values ($1, $2, 'pending')
     on conflict (club_id, user_id) do update set status = 'active', note = null
       where club_members.status = 'invited'
     returning status`,
    [req.params.id, req.user.id],
  );
  if (!rows[0]) return res.status(409).json({ error: 'Заявка уже отправлена' });

  res.status(201).json({ status: rows[0].status });
});

/**
 * Кого можно пригласить: поиск по имени, нику или почте. Рядом с каждым — его
 * отношение к клубу (уже участник, подал заявку, приглашён), чтобы окно не
 * предлагало пригласить того, кто и так здесь.
 */
router.get('/:id/candidates', requireAuth, requireRole(...MANAGE_ROLES), async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const text = String(req.query.q ?? '').trim().replace(/^@/, '');
  if (text.length < 2) return res.json({ candidates: [] });

  // % и _ в запросе — обычные символы, а не шаблон LIKE
  const pattern = `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const { rows } = await query(
    `select u.id, u.full_name, u.username, m.status
       from users u
       left join club_members m on m.club_id = $1 and m.user_id = u.id
      where u.id <> $3
        and (u.full_name ilike $2 or u.username ilike $2 or u.email ilike $2)
      order by u.full_name
      limit ${CANDIDATES_LIMIT}`,
    [req.params.id, pattern, req.user.id],
  );

  res.json({
    candidates: rows.map((row) => ({ ...publicMember(row), status: row.status ?? null })),
  });
});

/**
 * Приглашение в клуб. Человек не попадает в клуб сразу — ему приходит приглашение
 * с текстом, и участником он становится, только когда сам его примет.
 * Если он уже подал заявку, согласны обе стороны — он входит сразу.
 */
router.post('/:id/members', requireAuth, requireRole(...MANAGE_ROLES), async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const userId = String(req.body?.userId ?? '');
  if (!UUID_RE.test(userId)) return res.status(400).json({ error: 'Выберите, кого пригласить' });

  const note = req.body?.note ? String(req.body.note).trim() : '';
  if (note.length > NOTE_LIMIT) {
    return res.status(400).json({ error: 'Сообщение слишком длинное' });
  }

  const { rows: found } = await query('select id, full_name, username from users where id = $1', [
    userId,
  ]);
  if (!found[0]) return res.status(404).json({ error: 'Такого пользователя нет' });

  const { rows } = await query(
    `insert into club_members (club_id, user_id, status, note, invited_by)
     values ($1, $2, 'invited', $3, $4)
     on conflict (club_id, user_id) do update set status = 'active', note = null
       where club_members.status = 'pending'
     returning role, status`,
    [req.params.id, userId, note || null, req.user.id],
  );

  if (!rows[0]) {
    // Строка уже была и не заявка — значит, участник или уже приглашён
    const { rows: was } = await query(
      'select status from club_members where club_id = $1 and user_id = $2',
      [req.params.id, userId],
    );
    return res.status(409).json({
      error: was[0]?.status === 'invited' ? 'Приглашение уже отправлено' : 'Этот человек уже в клубе',
    });
  }

  res.status(201).json({
    member: publicMember({ ...found[0], role: rows[0].role }),
    status: rows[0].status,
  });
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

/**
 * В какой роли человек может убрать чужое сообщение в этом клубе: 'admin',
 * 'university' или 'lead' (лидер именно этого клуба). Иначе — null.
 */
async function moderatorRole(clubId, user) {
  if (user.role === 'admin' || user.role === 'university') return user.role;
  const { rows } = await query(
    `select 1 from club_members
      where club_id = $1 and user_id = $2 and role = 'lead' and status = 'active'`,
    [clubId, user.id],
  );
  return rows[0] ? 'lead' : null;
}

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
  // Удалено: содержимого нет, есть кто и в какой роли. Имя — на случай, если
  // удалил не автор: «удалено лидером клуба · Нұркелді А.»
  deleted: row.deleted_at
    ? {
        at: row.deleted_at,
        as: row.deleted_as,
        by: row.deleted_by_name ?? null,
      }
    : null,
  // Автора могли удалить: переписка остаётся, имя заменяется
  author: row.full_name ?? 'Удалённый участник',
  username: row.username ?? null,
  phone: row.phone ?? null,
  createdAt: row.created_at,
  // В ленте только адрес снимка: сами байты шли бы в каждом опросе заново
  photo: row.has_photo
    ? {
        url: `/api/clubs/${row.club_id}/messages/${row.id}/photo`,
        width: row.photo_width,
        height: row.photo_height,
      }
    : null,
  // Видео или документ: сам файл отдаёт .../files/:id, в ленте — только сведения
  file: row.file_id
    ? {
        url: `/api/clubs/${row.club_id}/files/${row.file_id}`,
        kind: row.file_kind,
        name: row.file_name,
        size: Number(row.file_size),
        width: row.file_width,
        height: row.file_height,
        duration: row.file_duration,
      }
    : null,
  // Процитированное могли удалить — тогда ссылка есть, а показывать нечего
  replyTo: row.reply_id
    ? {
        id: row.reply_id,
        text: row.reply_body,
        photo: row.reply_has_photo,
        file: row.reply_file_kind ? { kind: row.reply_file_kind, name: row.reply_file_name } : null,
        deleted: row.reply_deleted,
        authorId: row.reply_author_id,
        author: row.reply_full_name ?? 'Удалённый участник',
        username: row.reply_username ?? null,
      }
    : null,
});

// Цитата берётся тем же запросом: лента и так читается целиком
const MESSAGE_FIELDS = `m.id, m.club_id, m.body, m.author_id, m.created_at,
          m.photo is not null as has_photo, m.photo_width, m.photo_height,
          u.full_name, u.username, u.phone,
          r.id as reply_id, r.body as reply_body, r.author_id as reply_author_id,
          r.photo is not null as reply_has_photo,
          ru.full_name as reply_full_name, ru.username as reply_username,
          f.id as file_id, f.kind as file_kind, f.name as file_name, f.size as file_size,
          f.width as file_width, f.height as file_height, f.duration as file_duration,
          rf.kind as reply_file_kind, rf.name as reply_file_name,
          m.deleted_at, m.deleted_as, du.full_name as deleted_by_name,
          r.deleted_at is not null as reply_deleted`;

const MESSAGE_JOINS = `left join users u on u.id = m.author_id
       left join club_messages r on r.id = m.reply_to
       left join users ru on ru.id = r.author_id
       left join chat_files f on f.id = m.file_id
       left join chat_files rf on rf.id = r.file_id
       left join users du on du.id = m.deleted_by`;

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
    `select ${MESSAGE_FIELDS}
       from club_messages m
       ${MESSAGE_JOINS}
      where m.club_id = $1
      order by m.created_at desc
      limit $2`,
    [req.params.id, limit],
  );

  res.json({
    messages: rows.reverse().map(publicMessage),
    // Убирать чужие сообщения: университет, админ и лидер этого клуба
    canModerate: Boolean(await moderatorRole(req.params.id, req.user)),
  });
});

router.post('/:id/messages', requireAuth, async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }
  if (!(await canReadChat(req.params.id, req.user))) {
    return res.status(403).json({ error: 'Писать в чат могут только участники клуба' });
  }

  const text = String(req.body?.text ?? '').trim();
  const photo = req.body?.photo ? String(req.body.photo) : null;
  const fileId = req.body?.fileId ? String(req.body.fileId) : null;
  // Вложение может уйти без подписи, но пустым сообщение быть не может
  if (!text && !photo && !fileId) return res.status(400).json({ error: 'Сообщение пустое' });
  if (photo && fileId) {
    return res.status(400).json({ error: 'Одно вложение на сообщение' });
  }
  // Приложить можно только свой, только что загруженный в этот же чат файл
  if (fileId) {
    const { rows: own } = UUID_RE.test(fileId)
      ? await query(
          `select 1 from chat_files f
            where f.id = $1 and f.club_id = $2 and f.uploader_id = $3
              and not exists (select 1 from club_messages m where m.file_id = f.id)`,
          [fileId, req.params.id, req.user.id],
        )
      : { rows: [] };
    if (!own[0]) return res.status(400).json({ error: 'Файл не найден — загрузите его ещё раз' });
  }
  if (text.length > MESSAGE_LIMIT) {
    return res.status(400).json({ error: 'Сообщение слишком длинное' });
  }

  const photoWidth = photo ? Number(req.body.photoWidth) : null;
  const photoHeight = photo ? Number(req.body.photoHeight) : null;
  if (photo) {
    if (!CHAT_PHOTO_RE.test(photo)) {
      return res.status(400).json({ error: 'Можно отправить только изображение' });
    }
    if (photo.length > CHAT_PHOTO_LIMIT) {
      return res.status(400).json({ error: 'Фото слишком большое' });
    }
    const valid = (side) => Number.isInteger(side) && side > 0 && side <= PHOTO_SIDE_LIMIT;
    if (!valid(photoWidth) || !valid(photoHeight)) {
      return res.status(400).json({ error: 'Некорректный размер фото' });
    }
  }

  const replyTo = req.body?.replyTo ? String(req.body.replyTo) : null;
  if (replyTo && !UUID_RE.test(replyTo)) {
    return res.status(400).json({ error: 'Некорректная ссылка на сообщение' });
  }

  const { rows: created } = await query(
    `insert into club_messages
       (club_id, author_id, body, reply_to, photo, photo_width, photo_height, file_id)
     -- отвечать можно только на сообщение этого же клуба
     select $1, $2, $3, r.id, $5, $6, $7, $8
       from (select null::uuid as id) empty
       left join club_messages r on r.id = $4 and r.club_id = $1
     returning id`,
    [req.params.id, req.user.id, text, replyTo, photo, photoWidth, photoHeight, fileId],
  );

  // Читаем обратно вместе с цитатой — тем же запросом, что и ленту
  const { rows } = await query(
    `select ${MESSAGE_FIELDS} from club_messages m ${MESSAGE_JOINS} where m.id = $1`,
    [created[0].id],
  );

  res.status(201).json({ message: publicMessage(rows[0]) });
});

/**
 * Снимок сообщения — отдельным адресом, с теми же правами, что и лента.
 * Сообщение не редактируется, значит и снимок по этому адресу не меняется никогда:
 * браузер кэширует его насовсем, и опрос ленты не тянет картинки повторно.
 */
router.get('/:id/messages/:messageId/photo', requireAuth, async (req, res) => {
  const { id, messageId } = req.params;
  if (!UUID_RE.test(messageId) || !(await findClub(id))) {
    return res.status(404).json({ error: 'Фото не найдено' });
  }
  if (!(await canReadChat(id, req.user))) {
    return res.status(403).json({ error: 'Чат доступен только участникам клуба' });
  }

  const { rows } = await query(
    'select photo from club_messages where id = $1 and club_id = $2 and photo is not null',
    [messageId, id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Фото не найдено' });

  // data:image/jpeg;base64,<данные> — тип до «;», данные после «,»
  const { photo } = rows[0];
  res
    .set('Cache-Control', 'private, max-age=31536000, immutable')
    .type(photo.slice('data:'.length, photo.indexOf(';')))
    .send(Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64'));
});

/** Размер кадра и длительность видео: присылает браузер, прочитав файл до отправки. */
const videoNumber = (value, max) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= max ? number : null;
};

// Файл, загруженный, но так и не отправленный, дольше этого не хранится
const ORPHAN_AGE = '1 hour';

/**
 * Загрузка вложения: тело запроса — сам файл (application/octet-stream), имя —
 * в заголовке X-File-Name (encodeURIComponent: заголовки не несут кириллицу).
 * Файл сразу ложится на диск; сообщением он становится следующим запросом.
 */
router.post('/:id/files', requireAuth, async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }
  if (!(await canReadChat(req.params.id, req.user))) {
    return res.status(403).json({ error: 'Писать в чат могут только участники клуба' });
  }

  let name = '';
  try {
    name = cleanName(decodeURIComponent(req.get('X-File-Name') ?? ''));
  } catch {
    // кривая кодировка имени — то же, что пустое имя
  }
  if (!name) return res.status(400).json({ error: 'Не указано имя файла' });

  const type = classify(name);
  if (!type) {
    return rejectAfterBody(req, () =>
      res.status(400).json({ error: 'Такой файл отправить нельзя' }),
    );
  }
  const tooLarge = {
    video: 'Видео больше 100 МБ',
    image: 'Фото больше 25 МБ',
    document: 'Документ больше 25 МБ',
  }[type.kind];

  // Размер сверяем до записи: на диск не ляжет то, что всё равно отвергнем
  const declared = Number(req.get('Content-Length'));
  if (declared > type.limit) {
    return rejectAfterBody(req, () => res.status(413).json({ error: tooLarge }));
  }

  const { rows } = await query('select gen_random_uuid() as id');
  const id = rows[0].id;

  let size;
  try {
    size = await saveBody(req, id, type.limit);
  } catch (failure) {
    if (failure instanceof TooLarge) return res.status(413).json({ error: tooLarge });
    throw failure;
  }
  if (!size) {
    await removeFile(id);
    return res.status(400).json({ error: 'Файл пустой' });
  }

  const video = type.kind === 'video';
  await query(
    `insert into chat_files (id, club_id, uploader_id, kind, name, mime, size, width, height, duration)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      req.params.id,
      req.user.id,
      type.kind,
      name,
      type.mime,
      size,
      video ? videoNumber(req.get('X-Video-Width'), 8192) : null,
      video ? videoNumber(req.get('X-Video-Height'), 8192) : null,
      video ? videoNumber(req.get('X-Video-Duration'), 86400) : null,
    ],
  );

  // Заодно убираем брошенные: загрузили, но так и не отправили
  const { rows: orphans } = await query(
    `delete from chat_files f
      where f.club_id = $1 and f.created_at < now() - interval '${ORPHAN_AGE}'
        and not exists (select 1 from club_messages m where m.file_id = f.id)
      returning id`,
    [req.params.id],
  );
  await Promise.all(orphans.map((orphan) => removeFile(orphan.id)));

  res.status(201).json({ file: { id, kind: type.kind, name, size } });
});

/**
 * Файл вложения — с теми же правами, что и лента. Видео отдаётся на месте и с
 * перемоткой (sendFile понимает Range), документ — только скачиванием: ничего
 * из присланного не открывается страницей. Тип — наш, не угаданный браузером.
 */
router.get('/:id/files/:fileId', requireAuth, async (req, res) => {
  const { id, fileId } = req.params;
  if (!UUID_RE.test(fileId) || !(await findClub(id))) {
    return res.status(404).json({ error: 'Файл не найден' });
  }
  if (!(await canReadChat(id, req.user))) {
    return res.status(403).json({ error: 'Чат доступен только участникам клуба' });
  }

  const { rows } = await query(
    'select kind, name, mime from chat_files where id = $1 and club_id = $2',
    [fileId, id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Файл не найден' });

  const { kind, name, mime } = rows[0];
  // Видео и снимок смотрят на месте; документ — только скачать
  const disposition = kind === 'document' ? 'attachment' : 'inline';
  res.set({
    'Content-Type': mime,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
    'X-Content-Type-Options': 'nosniff',
    // Сообщение не редактируется — файл по этому адресу не меняется никогда
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
  res.sendFile(filePath(fileId), (failure) => {
    if (failure && !res.headersSent) res.status(404).json({ error: 'Файл не найден' });
  });
});

// Ссылка — до пробела; хвостовую пунктуацию предложения в адрес не берём.
// Тот же шаблон стоит в ленте (web/src/chat.js): что подсвечено — то и собрано
const LINK_RE = /https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/g;
const MEDIA_LIMIT = 200;

/**
 * Медиа, ссылки и документы чата: снимки и видео — адресами (байты отдаются
 * отдельно), ссылки — выбранными из текста сообщений, документы — списком.
 */
router.get('/:id/media', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!(await findClub(id))) return res.status(404).json({ error: 'Клуб не найден' });
  if (!(await canReadChat(id, req.user))) {
    return res.status(403).json({ error: 'Чат доступен только участникам клуба' });
  }

  const { rows: photos } = await query(
    `select id, photo_width, photo_height, created_at
       from club_messages
      where club_id = $1 and photo is not null
      order by created_at desc
      limit $2`,
    [id, MEDIA_LIMIT],
  );

  // Грубый отбор в базе (~*), точный — тем же шаблоном, что и в ленте
  const { rows: texts } = await query(
    `select m.id, m.body, m.created_at, u.full_name
       from club_messages m
       left join users u on u.id = m.author_id
      where m.club_id = $1 and m.body ~* 'https?://'
      order by m.created_at desc
      limit $2`,
    [id, MEDIA_LIMIT],
  );

  const { rows: files } = await query(
    `select m.id as message_id, m.created_at, f.id, f.kind, f.name, f.size,
            f.width, f.height, f.duration, u.full_name
       from club_messages m
       join chat_files f on f.id = m.file_id
       left join users u on u.id = m.author_id
      where m.club_id = $1
      order by m.created_at desc
      limit $2`,
    [id, MEDIA_LIMIT],
  );
  const fileOf = (row) => ({
    id: row.id,
    messageId: row.message_id,
    url: `/api/clubs/${id}/files/${row.id}`,
    kind: row.kind,
    name: row.name,
    size: Number(row.size),
    width: row.width,
    height: row.height,
    duration: row.duration,
    author: row.full_name ?? 'Удалённый участник',
    createdAt: row.created_at,
  });

  res.json({
    // Снимки Apple оригиналом — в той же сетке, что и обычные фото (см. photos ниже)
    images: files.filter((row) => row.kind === 'image').map(fileOf),
    videos: files.filter((row) => row.kind === 'video').map(fileOf),
    documents: files.filter((row) => row.kind === 'document').map(fileOf),
    photos: photos.map((row) => ({
      id: row.id,
      url: `/api/clubs/${id}/messages/${row.id}/photo`,
      width: row.photo_width,
      height: row.photo_height,
      createdAt: row.created_at,
    })),
    links: texts.flatMap((row) =>
      (row.body.match(LINK_RE) ?? []).map((url) => ({
        messageId: row.id,
        url,
        author: row.full_name ?? 'Удалённый участник',
        createdAt: row.created_at,
      })),
    ),
  });
});

/**
 * Уведомления чата для себя: включить или выключить. Выключенные хранятся
 * строкой в chat_mutes, включённые — её отсутствием.
 */
router.put('/:id/notifications', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!(await findClub(id))) return res.status(404).json({ error: 'Клуб не найден' });
  if (!(await canReadChat(id, req.user))) {
    return res.status(403).json({ error: 'Чат доступен только участникам клуба' });
  }

  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Укажите, включить уведомления или выключить' });
  }

  await query(
    enabled
      ? 'delete from chat_mutes where user_id = $1 and club_id = $2'
      : `insert into chat_mutes (user_id, club_id) values ($1, $2)
         on conflict do nothing`,
    [req.user.id, id],
  );

  res.json({ enabled });
});

/**
 * Удаление сообщения: своё — автору, любое — университету, админу и лидеру клуба.
 * Удалённое остаётся в ленте строкой «Сообщение удалено» — с тем, кто удалил.
 * Правка не предусмотрена: исправленная реплика в чужой памяти уже прочитана,
 * а след «изменено» — отдельная история, которой пока нет.
 */
router.delete('/:id/messages/:messageId', requireAuth, async (req, res) => {
  const { id, messageId } = req.params;
  if (!UUID_RE.test(messageId) || !(await findClub(id))) {
    return res.status(404).json({ error: 'Сообщение не найдено' });
  }
  if (!(await canReadChat(id, req.user))) {
    return res.status(403).json({ error: 'Чат доступен только участникам клуба' });
  }

  const { rows: found } = await query(
    `select author_id, file_id from club_messages
      where id = $1 and club_id = $2 and deleted_at is null`,
    [messageId, id],
  );
  if (!found[0]) return res.status(404).json({ error: 'Сообщение не найдено' });

  // Своё удаляет автор; чужое — университет, админ и лидер клуба. В какой роли
  // удалили, запоминаем сейчас: роль потом может смениться, а след — нет
  const own = found[0].author_id === req.user.id;
  const as = own ? 'author' : await moderatorRole(id, req.user);
  if (!as) return res.status(404).json({ error: 'Сообщение не найдено' });

  // Сообщение не исчезает — на его месте остаётся «удалено». Текст, снимок,
  // вложение и цитата стираются: остаётся только факт и кто
  await query(
    `update club_messages
        set body = '', photo = null, photo_width = null, photo_height = null,
            file_id = null, reply_to = null,
            deleted_at = now(), deleted_by = $2, deleted_as = $3
      where id = $1`,
    [messageId, req.user.id, as],
  );

  // Вложение жило только ради своего сообщения — уходит с диска
  if (found[0].file_id) {
    await query('delete from chat_files where id = $1', [found[0].file_id]);
    await removeFile(found[0].file_id);
  }

  const { rows } = await query(
    `select ${MESSAGE_FIELDS} from club_messages m ${MESSAGE_JOINS} where m.id = $1`,
    [messageId],
  );
  res.json({ message: publicMessage(rows[0]) });
});

const TITLE_LIMIT = 120;
const PLACE_LIMIT = 200;

const publicEvent = (row) => ({
  id: row.id,
  title: row.title,
  place: row.place,
  startsAt: row.starts_at,
});

/** Мероприятия клуба. Видны всем вошедшим — страница клуба тоже открыта. */
router.get('/:id/events', requireAuth, async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const { rows } = await query(
    `select id, title, place, starts_at
       from club_events
      where club_id = $1
      order by starts_at`,
    [req.params.id],
  );

  res.json({ events: rows.map(publicEvent) });
});

router.post('/:id/events', requireAuth, requireRole(...MANAGE_ROLES), async (req, res) => {
  if (!(await findClub(req.params.id))) {
    return res.status(404).json({ error: 'Клуб не найден' });
  }

  const title = String(req.body?.title ?? '').trim().replace(/\s+/g, ' ');
  const place = req.body?.place ? String(req.body.place).trim() : null;
  const startsAt = new Date(req.body?.startsAt ?? '');

  if (title.length < 2) return res.status(400).json({ error: 'Укажите название события' });
  if (title.length > TITLE_LIMIT) return res.status(400).json({ error: 'Название слишком длинное' });
  if (place && place.length > PLACE_LIMIT) {
    return res.status(400).json({ error: 'Место слишком длинное' });
  }
  // Number.isNaN у невалидной даты — единственный способ её поймать
  if (Number.isNaN(startsAt.getTime())) {
    return res.status(400).json({ error: 'Укажите дату и время' });
  }

  const { rows } = await query(
    `insert into club_events (club_id, title, place, starts_at, created_by)
     values ($1, $2, $3, $4, $5)
     returning id, title, place, starts_at`,
    [req.params.id, title, place, startsAt.toISOString(), req.user.id],
  );

  res.status(201).json({ event: publicEvent(rows[0]) });
});

router.delete(
  '/:id/events/:eventId',
  requireAuth,
  requireRole(...MANAGE_ROLES),
  async (req, res) => {
    const { id, eventId } = req.params;
    if (!UUID_RE.test(eventId) || !(await findClub(id))) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }

    const { rows } = await query(
      'delete from club_events where id = $1 and club_id = $2 returning id',
      [eventId, id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Событие не найдено' });

    res.json({ ok: true });
  },
);

export default router;
