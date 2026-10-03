import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { audience } from '../rooms.js';

const router = Router();

/**
 * Живая лента событий чата — Server-Sent Events.
 *
 * **Почему SSE, а не WebSocket.** Нам нужно одно направление: сервер сообщает,
 * что в чате что-то произошло. SSE — это обычный HTTP-ответ, который не
 * закрывают: ни нового пакета (§2), ни своего протокола, ни рукопожатия, а
 * переподключение браузер берёт на себя. Куки уходят сами, поэтому и вход
 * проверяется обычным `requireAuth`.
 *
 * Опрос при этом остаётся — но редкий, как страховка: соединение могут порвать
 * прокси или сон ноутбука, и тогда лента догонит себя сама.
 */

// Кто сейчас слушает: id человека → его открытые вкладки. Живёт в памяти:
// при перезапуске сервера браузеры просто переподключатся
const listeners = new Map();

// Тихое соединение прокси считают брошенным — подаём знак жизни
const BEAT_MS = 25_000;

function deliver(userId, line) {
  const tabs = listeners.get(userId);
  if (!tabs) return;
  for (const res of tabs) res.write(line);
}

/**
 * Разослать событие всем, кому видно происходящее в чате: его собеседникам и —
 * у клуба — тем, кто видит все клубы. Тот же круг, что и у чтения чата, — иначе
 * о жизни чужого клуба узнавал бы посторонний. В личный чат управляющие роли
 * не заглядывают, поэтому и события оттуда к ним не идут.
 */
export async function publish(clubId, event) {
  const { rows } = await query(
    `${audience('$1')}
     union
     select u.id from users u
      where u.role in ('university', 'admin')
        and exists (select 1 from clubs c where c.id = $1 and c.direct_user_id is null)`,
    [clubId],
  );

  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const row of rows) deliver(row.id, line);
}

/** Разослать и не ждать: событие не должно задерживать ответ на действие. */
export const announce = (clubId, event) => {
  publish(clubId, event).catch(() => {});
};

router.get('/', requireAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    // no-transform — чтобы посредники не собирали ответ в буфер
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  // Сколько ждать перед переподключением, если связь оборвётся
  res.write('retry: 3000\n\n');

  const tabs = listeners.get(req.user.id) ?? new Set();
  tabs.add(res);
  listeners.set(req.user.id, tabs);

  const beat = setInterval(() => res.write(': ping\n\n'), BEAT_MS);

  req.on('close', () => {
    clearInterval(beat);
    tabs.delete(res);
    if (!tabs.size) listeners.delete(req.user.id);
  });
});

export default router;
