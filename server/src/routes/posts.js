import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { CHAT_PHOTO_LIMIT, CHAT_PHOTO_RE, PHOTO_SIDE_LIMIT } from './clubs.js';
import { canPost, targetsFor } from './stories.js';

const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Текст — тот же предел, что у сообщения и описания клуба: он один на проект
const TEXT_LIMIT = 2000;
const PHOTOS_LIMIT = 10;
// ponytail: лента отдаётся одной страницей — подгрузка по прокрутке, когда
// публикаций станет больше, чем помещается в этот предел
const FEED_PAGE = 30;

/**
 * Лента публикаций, новые сверху. Публикует тот же круг, что и истории: клуб
 * (его руководитель) и университет — поэтому автор здесь «рассказчик», а не человек.
 *
 * Рассказчики отданы отдельным словарём: снимок клуба — строка data URL, и у
 * десяти публикаций одного клуба она пришла бы десять раз. Сами снимки
 * публикаций — только адресами, как в ленте чата.
 */
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query(
    `select p.id, p.club_id, p.author_id, p.body, p.created_at,
            c.name as club_name, c.photo_url as club_photo,
            u.full_name as author_name, u.photo is not null as author_has_photo,
            coalesce((
              select json_agg(json_build_object('n', ph.position, 'w', ph.width, 'h', ph.height)
                              order by ph.position)
                from post_photos ph where ph.post_id = p.id
            ), '[]') as photos
       from posts p
       left join clubs c on c.id = p.club_id
       join users u on u.id = p.author_id
      order by p.created_at desc
      limit $1`,
    [FEED_PAGE],
  );

  const boss = req.user.role === 'university' || req.user.role === 'admin';
  const tellers = {};
  const posts = rows.map((row) => {
    const key = row.club_id ? `club:${row.club_id}` : `user:${row.author_id}`;
    tellers[key] ??= row.club_id
      ? { name: row.club_name, photo: row.club_photo }
      : {
          name: row.author_name,
          photo: row.author_has_photo ? `/api/users/${row.author_id}/photo` : null,
        };

    return {
      id: row.id,
      teller: key,
      text: row.body,
      createdAt: row.created_at,
      photos: row.photos.map((photo) => ({
        url: `/api/posts/${row.id}/photos/${photo.n}`,
        width: photo.w,
        height: photo.h,
      })),
      canDelete: boss || row.author_id === req.user.id,
    };
  });

  res.json({ posts, tellers });
});

/** От чьего имени этот человек может публиковать. Путь стоит выше /:id. */
router.get('/targets', requireAuth, async (req, res) => {
  res.json({ targets: await targetsFor(req.user) });
});

/**
 * Новая публикация: общий текст и до десяти снимков. Снимки приходят строками
 * data URL — их уже ужал браузер, как и фото в чате; порядок в списке и есть
 * порядок показа. Пустой публикация быть не может: либо текст, либо снимок.
 */
router.post('/', requireAuth, async (req, res) => {
  const clubId = req.body?.club ?? null;
  if (clubId && !UUID.test(clubId)) return res.status(400).json({ error: 'Клуб не найден' });
  if (!(await canPost(clubId, req.user))) {
    return res.status(403).json({ error: 'Публиковать может клуб или университет' });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (text.length > TEXT_LIMIT) return res.status(400).json({ error: 'Текст слишком длинный' });

  const photos = req.body?.photos ?? [];
  if (!Array.isArray(photos)) return res.status(400).json({ error: 'Некорректный список фото' });
  if (photos.length > PHOTOS_LIMIT) {
    return res.status(400).json({ error: `Не больше ${PHOTOS_LIMIT} фото в публикации` });
  }
  if (!text && !photos.length) return res.status(400).json({ error: 'Публикация пустая' });

  const side = (value) => Number.isInteger(value) && value > 0 && value <= PHOTO_SIDE_LIMIT;
  for (const item of photos) {
    if (typeof item?.photo !== 'string' || !CHAT_PHOTO_RE.test(item.photo)) {
      return res.status(400).json({ error: 'Можно прикрепить только изображения' });
    }
    if (item.photo.length > CHAT_PHOTO_LIMIT) {
      return res.status(400).json({ error: 'Фото слишком большое' });
    }
    if (!side(item.width) || !side(item.height)) {
      return res.status(400).json({ error: 'Некорректный размер фото' });
    }
  }

  // Публикация и её снимки — одним запросом: либо есть всё, либо ничего
  const { rows } = await query(
    `with created as (
       insert into posts (club_id, author_id, body) values ($1, $2, $3) returning id
     ), attached as (
       insert into post_photos (post_id, position, photo, width, height)
       select created.id, t.position, t.photo, t.width, t.height
         from created,
              unnest($4::text[], $5::int[], $6::int[]) with ordinality
                as t(photo, width, height, position)
     )
     select id from created`,
    [
      clubId,
      req.user.id,
      text,
      photos.map((item) => item.photo),
      photos.map((item) => item.width),
      photos.map((item) => item.height),
    ],
  );

  res.status(201).json({ id: rows[0].id });
});

/**
 * Снимок публикации — отдельным адресом. Публикация не редактируется, значит и
 * снимок по этому адресу не меняется: браузер кэширует его насовсем.
 */
router.get('/:id/photos/:position', requireAuth, async (req, res) => {
  const position = Number(req.params.position);
  if (!UUID.test(req.params.id) || !Number.isInteger(position)) {
    return res.status(404).json({ error: 'Фото не найдено' });
  }

  const { rows } = await query(
    'select photo from post_photos where post_id = $1 and position = $2',
    [req.params.id, position],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Фото не найдено' });

  // data:image/jpeg;base64,<данные> — тип до «;», данные после «,»
  const { photo } = rows[0];
  res
    .set('Cache-Control', 'private, max-age=31536000, immutable')
    .type(photo.slice('data:'.length, photo.indexOf(';')))
    .send(Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64'));
});

/** Убрать свою публикацию; университет и админ убирают любую. Снимки уходят каскадом. */
router.delete('/:id', requireAuth, async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Публикация не найдена' });

  const boss = req.user.role === 'university' || req.user.role === 'admin';
  const { rows } = await query(
    'delete from posts where id = $1 and ($2 or author_id = $3) returning id',
    [req.params.id, boss, req.user.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Публикация не найдена' });

  res.json({ ok: true });
});

export default router;
