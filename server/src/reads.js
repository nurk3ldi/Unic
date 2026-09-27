/**
 * Что человек прочитал в чатах. Хранится одной отметкой на чат — до какого
 * момента прочитано (chat_reads.read_at), а не пометкой на каждом сообщении:
 * так «непрочитанные» — это просто сообщения новее отметки.
 *
 * Если отметки ещё нет, считаем от вступления в клуб (история до тебя — не
 * «новое для тебя»), а у университета и админа, которые не в составе, — от
 * создания аккаунта.
 *
 * Обе функции собирают кусок SQL: `user` и `club` — выражения запроса
 * (параметр вроде $1 или столбец вроде c.id), значения сюда не подставляются.
 */
export const readSince = (user, club) => `coalesce(
  (select r.read_at from chat_reads r where r.user_id = ${user} and r.club_id = ${club}),
  (select mm.created_at from club_members mm where mm.club_id = ${club} and mm.user_id = ${user}),
  (select uu.created_at from users uu where uu.id = ${user})
)`;

/** Сколько непрочитанных: чужие, не удалённые, новее отметки. */
export const unreadCount = (user, club) => `(
  select count(*)::int from club_messages x
   where x.club_id = ${club} and x.deleted_at is null
     and x.author_id is distinct from ${user}
     and x.created_at > ${readSince(user, club)}
)`;
