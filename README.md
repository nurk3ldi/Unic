# Unic

Система управления клубами университета. React + Node.js + PostgreSQL.
Интерфейс — только на русском языке, светлая тема, дизайн по правилам Apple.

## Запуск

```bash
npm install
npm run db:setup   # создаёт базу, применяет схему, добавляет демо-пользователей
npm run dev        # API :4400 + веб :5300
```

Перед первым запуском укажите пароль PostgreSQL в `server/.env`:

```
DATABASE_URL=postgres://postgres:ВАШ_ПАРОЛЬ@localhost:5432/unic
```

## Демо-доступы

Пароль у всех: `password123`

| Почта | Роль |
|---|---|
| `admin@unic.kz` | Администратор |
| `university@unic.kz` | Университет |
| `lead@unic.kz` | Руководитель клуба |
| `student@unic.kz` | Студент |

## Правила разработки

Все архитектурные и дизайнерские правила — в [CLAUDE.md](CLAUDE.md).
