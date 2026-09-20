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
