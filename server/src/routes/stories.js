import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { directRoom } from '../rooms.js';
import { announce } from './stream.js';
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

// Сутки — столько живёт история. Срок один и тот же в трёх местах (выдача,
// уборка, ответ), поэтому лежит здесь
export const LIFETIME = "24 hours";

// Сколько живых историй может быть у одного рассказчика (клуба или аккаунта) разом —
// то есть за сутки: старше суток история и так уходит
const DAILY_LIMIT = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Число из заголовка: только положительное и в пределах разумного. */
function videoNumber(raw, max) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= max ? Math.round(value) : null;
}

/**
 * Кто может публиковать: университет и админ — от себя или от любого клуба,
 * руководитель — только от своего. Студент не публикует вовсе.
 */
async function canPost(clubId, user) {
  if (user.role === 'university' || user.role === 'admin') return true;
  return Boolean(clubId) && leads(clubId, user.id);
}

/** Руководит ли человек этим клубом. */
async function leads(clubId, userId) {
  const { rows } = await query(
    `select 1 from club_members
      where club_id = $1 and user_id = $2 and role = 'lead' and status = 'active'`,
    [clubId, userId],
  );
  return rows.length > 0;
}

/** Файлы историй, которым вышел срок, с диска и из базы — заодно с публикацией. */
async function sweep() {
  const { rows } = await query(
    `delete from stories where created_at <= now() - interval '${LIFETIME}' returning id`,
  );
  await Promise.all(rows.map((row) => removeFile(row.id)));
}

/**
 * От чьего имени этот человек может публиковать: университет и админ — от себя,
 * руководитель — от каждого своего клуба. Пустой список значит «кнопки нет».
 */
async function targetsFor(user) {
  if (user.role === 'university' || user.role === 'admin') {
    return [{ club: null, key: `user:${user.id}`, name: user.full_name }];
  }

  const { rows } = await query(
    `select c.id, c.name
       from club_members m
       join clubs c on c.id = m.club_id
      where m.user_id = $1 and m.role = 'lead' and m.status = 'active'
      order by c.name`,
    [user.id],
  );
  return rows.map((row) => ({ club: row.id, key: `club:${row.id}`, name: row.name }));
}

/**
 * Живые истории, собранные по рассказчику: клуб или сам аккаунт. Внутри —
 * от старой к новой, как их и смотрят.
 */
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `select s.id, s.club_id, s.author_id, s.kind, s.width, s.height, s.duration, s.created_at,
            c.name as club_name, c.photo_url as club_photo,
            u.full_name as author_name, u.photo as author_photo,
            exists(select 1 from story_likes l where l.story_id = s.id and l.user_id = $1) as liked,
            exists(select 1 from story_views v where v.story_id = s.id and v.user_id = $1) as seen
       from stories s
       left join clubs c on c.id = s.club_id
       join users u on u.id = s.author_id
      where s.created_at > now() - interval '${LIFETIME}'
      order by s.created_at`,
    [req.user.id],
  );

  // Рассказчики идут в порядке первой истории — кто начал раньше, тот и левее
  const tellers = new Map();
  for (const row of rows) {
    const key = row.club_id ? `club:${row.club_id}` : `user:${row.author_id}`;
    if (!tellers.has(key)) {
      tellers.set(key, {
        key,
        name: row.club_id ? row.club_name : row.author_name,
        photo: row.club_id ? row.club_photo : row.author_photo,
        items: [],
      });
    }
    tellers.get(key).items.push({
      id: row.id,
      kind: row.kind,
      url: `/api/stories/${row.id}/file`,
      width: row.width,
      height: row.height,
      duration: row.duration,
      createdAt: row.created_at,
      liked: row.liked,
      seen: row.seen,
      canDelete: row.author_id === req.user.id || req.user.role === 'university' || req.user.role === 'admin',
    });
  }

  // Сколько ещё можно выложить от каждого имени — чтобы не грузить файл впустую
  const targets = (await targetsFor(req.user)).map((target) => {
    // Свой рассказчик: под его историями нет поля ответа — себе не пишут
    const own = tellers.get(target.key);
    if (own) own.own = true;
    return { ...target, left: Math.max(0, DAILY_LIMIT - (own?.items.length ?? 0)) };
  });

  res.json({ tellers: [...tellers.values()], targets });
});

/**
 * Публикация: тело запроса — сам файл, имя в заголовке (кириллица в заголовки
 * не помещается, поэтому `encodeURIComponent`). Клуб — необязателен: без него
 * история идёт от аккаунта.
 */
router.post('/', requireAuth, async (req, res) => {
  const clubId = req.get('X-Club-Id') || null;
  if (clubId && !UUID.test(clubId)) {
    return rejectAfterBody(req, () => res.status(400).json({ error: 'Клуб не найден' }));
  }
  if (!(await canPost(clubId, req.user))) {
    return rejectAfterBody(req, () =>
      res.status(403).json({ error: 'Публиковать истории может клуб или университет' }),
    );
  }

  // Лимит — до чтения тела: сто мегабайт видео не должны грузиться ради отказа.
  // Без клуба рассказчик — сам аккаунт, как и в выдаче
  const { rows: live } = await query(
    `select count(*)::int as count from stories
      where created_at > now() - interval '${LIFETIME}'
        and (case when $1::uuid is null then club_id is null and author_id = $2
                  else club_id = $1::uuid end)`,
    [clubId, req.user.id],
  );
  if (live[0].count >= DAILY_LIMIT) {
    return rejectAfterBody(req, () =>
      res.status(429).json({ error: `Не больше ${DAILY_LIMIT} историй в сутки` }),
    );
  }

  let name = '';
  try {
    name = cleanName(decodeURIComponent(req.get('X-File-Name') ?? ''));
  } catch {
    // кривая кодировка имени — то же, что пустое имя
  }
  if (!name) {
    return rejectAfterBody(req, () => res.status(400).json({ error: 'Не указано имя файла' }));
  }

  // В историю идут только снимок и видео: документ или звук показать нечем
  const type = classify(name);
  if (!type || (type.kind !== 'image' && type.kind !== 'video')) {
    return rejectAfterBody(req, () =>
      res.status(400).json({ error: 'В историю можно выложить фото или видео' }),
    );
  }

  const width = videoNumber(req.get('X-Video-Width'), 8192);
  const height = videoNumber(req.get('X-Video-Height'), 8192);
  if (type.kind === 'video' && (!width || !height || Math.abs(width / height - 9 / 16) > 0.001)) {
    return rejectAfterBody(req, () =>
      res.status(400).json({ error: 'Для истории выберите видео в формате 9:16' }),
    );
  }

  const tooLarge = type.kind === 'video' ? 'Видео больше 100 МБ' : 'Фото больше 25 МБ';
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
    `insert into stories (id, club_id, author_id, kind, mime, size, width, height, duration)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      clubId,
      req.user.id,
      type.kind,
      type.mime,
      size,
      width,
      height,
      video ? videoNumber(req.get('X-Video-Duration'), 86400) : null,
    ],
  );

  await sweep();
  res.status(201).json({ id });
});

async function liveStory(id) {
  if (!UUID.test(id)) return null;
  const { rows } = await query(
    `select id, author_id, club_id from stories
      where id = $1 and created_at > now() - interval '${LIFETIME}'`,
    [id],
  );
  return rows[0] ?? null;
}

/** Один человек — один лайк; повтор того же запроса не меняет результат. */
router.put('/:id/like', requireAuth, async (req, res) => {
  if (typeof req.body?.liked !== 'boolean') return res.status(400).json({ error: 'Укажите состояние лайка' });
  if (!(await liveStory(req.params.id))) return res.status(404).json({ error: 'История недоступна' });
  if (req.body.liked) {
    await query('insert into story_likes (story_id, user_id) values ($1, $2) on conflict do nothing',
      [req.params.id, req.user.id]);
  } else {
    await query('delete from story_likes where story_id = $1 and user_id = $2', [req.params.id, req.user.id]);
  }
  res.json({ liked: req.body.liked });
});

/**
 * Своя ли это история: у клуба — для его руководителя, у аккаунта — для автора.
 * Себе не отвечают, зато только свои видят, кто их историю смотрел.
 */
const owns = (story, user) =>
  story.club_id ? leads(story.club_id, user.id) : story.author_id === user.id;

/**
 * Кто смотрел историю и кому она понравилась — только её хозяину. Сам он в
 * список не входит. Последние просмотры сверху.
 */
router.get('/:id/views', requireAuth, async (req, res) => {
  const story = await liveStory(req.params.id);
  if (!story) return res.status(404).json({ error: 'История недоступна' });
  if (!(await owns(story, req.user))) {
    return res.status(403).json({ error: 'Просмотры видит только автор истории' });
  }

  // Лайк без отметки о просмотре тоже считается: поставить его можно, только открыв историю
  const { rows } = await query(
    `select u.id, u.full_name, u.username, u.photo is not null as has_photo,
            l.user_id is not null as liked
       from users u
       left join story_views v on v.user_id = u.id and v.story_id = $1
       left join story_likes l on l.user_id = u.id and l.story_id = $1
      where (v.user_id is not null or l.user_id is not null) and u.id <> $2
      order by v.viewed_at desc nulls last, u.full_name`,
    [story.id, req.user.id],
  );

  res.json({
    viewers: rows.map((row) => ({
      id: row.id,
      name: row.full_name,
      username: row.username,
      photo: row.has_photo ? `/api/users/${row.id}/photo` : null,
      liked: row.liked,
    })),
  });
});

/** Историю открыли. Повторный просмотр ничего не меняет — отметка одна. */
router.put('/:id/view', requireAuth, async (req, res) => {
  if (!(await liveStory(req.params.id))) return res.status(404).json({ error: 'История недоступна' });
  await query('insert into story_views (story_id, user_id) values ($1, $2) on conflict do nothing',
    [req.params.id, req.user.id]);
  res.json({ seen: true });
});

/**
 * Ответ на историю — как в Instagram: уходит сообщением в личный чат с
 * рассказчиком, и дальше разговор идёт уже там. История клуба — чат с клубом
 * (отвечает его руководитель), история аккаунта — чат с этим человеком.
 * В ответ — id чата: клиент сразу его открывает.
 */
router.post('/:id/replies', requireAuth, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 2000) return res.status(400).json({ error: 'Ответ должен содержать от 1 до 2000 символов' });
  const story = await liveStory(req.params.id);
  if (!story) return res.status(404).json({ error: 'История недоступна' });

  // Себе не отвечают: поля под своей историей нет, но проверяет это сервер
  if (await owns(story, req.user)) return res.status(400).json({ error: 'Это ваша история' });

  const chatId = await directRoom(
    req.user.id,
    story.club_id ? { clubId: story.club_id } : { peerId: story.author_id },
  );
  await query(
    'insert into club_messages (club_id, author_id, body, story_id) values ($1, $2, $3, $4)',
    [chatId, req.user.id, text, story.id],
  );
  announce(chatId, { type: 'message', clubId: chatId, userId: req.user.id });
  res.status(201).json({ chatId });
});

/** Сам файл. История живёт сутки, но за эти сутки не меняется — можно кэшировать. */
router.get('/:id/file', requireAuth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'История не найдена' });

  const { rows } = await query(
    `select mime from stories
      where id = $1 and created_at > now() - interval '${LIFETIME}'`,
    [req.params.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'История не найдена' });

  res.type(rows[0].mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
  res.sendFile(filePath(req.params.id));
});

/** Снять свою историю раньше срока; университет и админ снимают любую. */
router.delete('/:id', requireAuth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'История не найдена' });

  const boss = req.user.role === 'university' || req.user.role === 'admin';
  const { rows } = await query(
    'delete from stories where id = $1 and ($2 or author_id = $3) returning id',
    [req.params.id, boss, req.user.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'История не найдена' });

  await removeFile(req.params.id);
  res.json({ ok: true });
});

export default router;
