import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Снимок человека — тот, что виден рядом с его репликами и в составе клуба.
 *
 * **Отдельным адресом, а не в ленте.** Опрос каждые пять секунд забирает
 * последние 50 сообщений; если бы аватар ехал байтами в каждом из них, опрос
 * весил бы мегабайты. В ленте — только ссылка сюда, а сам снимок браузер
 * берёт один раз на всех и держит в кэше (так же сделаны снимки в сообщениях).
 *
 * Кэш на пять минут: снимок, в отличие от сообщения, человек может сменить —
 * «навсегда» тут не годится. Дальше браузер переспрашивает, и ETag (его ставит
 * Express) отвечает «не менялся» без единого байта.
 *
 * Видит любой вошедший: аватар и так стоит рядом с каждой репликой и в каждом
 * списке, а адрес — случайный UUID, перебрать его нельзя.
 */
router.get('/:id/photo', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Фото не найдено' });

  const { rows } = await query('select photo from users where id = $1 and photo is not null', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Фото не найдено' });

  // data:image/jpeg;base64,<данные> — тип до «;», данные после «,»
  const { photo } = rows[0];
  res
    .set('Cache-Control', 'private, max-age=300')
    .type(photo.slice('data:'.length, photo.indexOf(';')))
    .send(Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64'));
});

export default router;
