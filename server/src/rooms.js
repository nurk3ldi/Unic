import { query } from './db.js';

/**
 * Комнаты чата. Клубный чат — это сам клуб. Личный чат — строка в той же таблице
 * `clubs`, у которой заполнен `direct_user_id`: человек пишет либо клубу
 * (`direct_club_id` — отвечает его руководитель), либо другому человеку
 * (`direct_peer_id`).
 *
 * ponytail: личный чат живёт строкой в `clubs`, потому что всё устройство чата
 * (сообщения, файлы, «прочитано», реакции, закрепления) привязано к `clubs.id` —
 * так оно достаётся личному чату целиком. Своя таблица `rooms` понадобится,
 * когда появятся чаты, не похожие ни на клуб, ни на разговор двоих.
 *
 * Обе функции ниже собирают кусок SQL: аргументы — выражения запроса (параметр
 * вроде $1 или псевдоним таблицы), значения сюда не подставляются.
 */

/**
 * Видит ли человек чат. Клуб — участникам и тем, кто клубами управляет
 * (`manages`). Личный чат — только двоим: управляющая роль туда не пускает.
 */
export const canRead = (user, manages, c = 'c') => `(
  case when ${c}.direct_user_id is null then
    ${manages} or exists (
      select 1 from club_members cm
       where cm.club_id = ${c}.id and cm.user_id = ${user} and cm.status = 'active')
  else
    ${user} = ${c}.direct_user_id
    or ${user} = ${c}.direct_peer_id
    or exists (
      select 1 from club_members l
       where l.club_id = ${c}.direct_club_id and l.user_id = ${user}
         and l.role = 'lead' and l.status = 'active')
  end
)`;

/**
 * Кто в чате собеседники — столбцом `id`: состав клуба либо двое из личного
 * чата (за клуб — его руководитель). По ним рассылаются события и считается ✓✓.
 */
export const audience = (room) => `
  select mm.user_id as id from club_members mm
   where mm.club_id = ${room} and mm.status = 'active'
  union
  select p.id from clubs dc
   cross join lateral (values (dc.direct_user_id), (dc.direct_peer_id)) p(id)
   where dc.id = ${room} and p.id is not null
  union
  select l.user_id from clubs dc
    join club_members l on l.club_id = dc.direct_club_id
                       and l.role = 'lead' and l.status = 'active'
   where dc.id = ${room}`;

/**
 * Личный чат человека с клубом или с другим человеком: находит или заводит.
 * Чат один на пару — это держит уникальный индекс, а не порядок вызовов:
 * если двое завели его разом, второй просто получит уже созданный.
 */
export async function directRoom(userId, { clubId = null, peerId = null }) {
  const find = () =>
    clubId
      ? query('select id from clubs where direct_user_id = $1 and direct_club_id = $2', [
          userId,
          clubId,
        ])
      : query(
          `select id from clubs
            where direct_peer_id is not null
              and least(direct_user_id, direct_peer_id) = least($1::uuid, $2::uuid)
              and greatest(direct_user_id, direct_peer_id) = greatest($1::uuid, $2::uuid)`,
          [userId, peerId],
        );

  const found = await find();
  if (found.rows[0]) return found.rows[0].id;

  // Названия у личного чата нет: собеседника список показывает по этим ссылкам
  const created = await query(
    `insert into clubs (name, direct_user_id, direct_club_id, direct_peer_id)
     values ('', $1, $2, $3)
     on conflict do nothing
     returning id`,
    [userId, clubId, peerId],
  );
  return created.rows[0]?.id ?? (await find()).rows[0].id;
}
