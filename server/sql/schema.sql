-- Unic — схема базы данных. Единственный источник истины.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  username      text not null unique,
  phone         text not null unique,
  password_hash text not null,
  full_name     text not null,
  role          text not null default 'student'
                check (role in ('admin', 'university', 'club_lead', 'student')),
  created_at    timestamptz not null default now()
);

create index if not exists users_role_idx on users (role);

-- Коды восстановления пароля. Одна строка на адрес: новый код заменяет прежний.
create table if not exists password_resets (
  email      text primary key,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);

-- Клубы университета. «Заявка» — это клуб со статусом pending, отдельной таблицы нет.
create table if not exists clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  photo_url   text,
  description text,
  status      text not null default 'active'
              check (status in ('active', 'pending', 'suspended')),
  created_by  uuid references users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Схема применяется поверх существующей базы: create table её не тронет,
-- поэтому новые столбцы добавляются отдельно
alter table clubs add column if not exists description text;
-- Принимает ли клуб заявки на вступление. По умолчанию — да: новый клуб открыт
alter table clubs add column if not exists accepting boolean not null default true;

-- Руководитель хранится в club_members.role. Два места для одного факта
-- рано или поздно расходятся, поэтому старый столбец убираем
alter table clubs drop column if exists lead_id;

create index if not exists clubs_status_idx on clubs (status);

-- Участники клуба. Заявка — та же строка со status = 'pending':
-- отдельная таблица заявок хранила бы ровно те же поля и те же связи
create table if not exists club_members (
  club_id    uuid not null references clubs (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  role       text not null default 'member' check (role in ('lead', 'member')),
  status     text not null default 'active' check (status in ('active', 'pending')),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- Руководитель в клубе один. Это правило базы, а не порядок вызовов в коде
create unique index if not exists club_members_lead_idx
  on club_members (club_id)
  where role = 'lead';

create index if not exists club_members_user_idx on club_members (user_id);

-- Сообщения клубного чата. Автор обнуляется, а не удаляется вместе с человеком:
-- переписка остаётся связной, даже когда аккаунта уже нет
create table if not exists club_messages (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs (id) on delete cascade,
  author_id  uuid references users (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- Чат всегда читают одним клубом и по времени
create index if not exists club_messages_club_idx on club_messages (club_id, created_at);

-- Мероприятия клуба
create table if not exists club_events (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs (id) on delete cascade,
  title       text not null,
  place       text,
  starts_at   timestamptz not null,
  created_by  uuid references users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Читают их по времени: сначала ближайшие
create index if not exists club_events_time_idx on club_events (starts_at);

-- Ответ — ссылка на другое сообщение того же клуба. on delete set null:
-- процитированное могли удалить, но сам ответ от этого не пропадает
alter table club_messages
  add column if not exists reply_to uuid references club_messages (id) on delete set null;

-- Фото в сообщении: data URL, как у фото клуба. Размеры хранятся рядом, чтобы
-- лента держала место под снимок до его загрузки и не прыгала.
-- Подпись необязательна: у сообщения-фото body — пустая строка
alter table club_messages add column if not exists photo text;
alter table club_messages add column if not exists photo_width int;
alter table club_messages add column if not exists photo_height int;

-- Уведомления чата выключены: строка есть — молчим. Хранится исключение,
-- а не правило: по умолчанию уведомления включены, и новому клубу ничего
-- заводить не нужно
create table if not exists chat_mutes (
  user_id uuid not null references users (id) on delete cascade,
  club_id uuid not null references clubs (id) on delete cascade,
  primary key (user_id, club_id)
);

-- Фото человека (у университета — логотип): data URL, как у фото клуба.
-- Сессия его не читает — слишком тяжёл для каждого запроса; отдаёт /me и вход
alter table users add column if not exists photo text;

-- Смена почты: код уходит на новый адрес и живёт здесь, пока его не введут.
-- Одна строка на человека: новый запрос заменяет прежний. Код — хэшем, как при
-- восстановлении пароля
create table if not exists email_changes (
  user_id    uuid primary key references users (id) on delete cascade,
  email      text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);
