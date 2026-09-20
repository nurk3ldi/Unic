// Создаёт базу (если её нет), применяет схему и наполняет демо-данными.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashPassword } from '../src/auth.js';

const here = dirname(fileURLToPath(import.meta.url));
const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.slice(1);

const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';

const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [dbName]);
if (!rowCount) {
  await admin.query(`create database "${dbName}"`);
  console.log(`База «${dbName}» создана`);
}
await admin.end();

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query(await readFile(join(here, 'schema.sql'), 'utf8'));
console.log('Схема применена');

const demo = [
  ['admin@unic.kz', 'Админ Системы', 'admin'],
  ['university@unic.kz', 'Университет KBTU', 'university'],
  ['lead@unic.kz', 'Айгерим Нурланова', 'club_lead'],
  ['student@unic.kz', 'Нуркелди Студент', 'student'],
];

for (const [email, fullName, role] of demo) {
  await db.query(
    `insert into users (email, password_hash, full_name, role)
     values ($1, $2, $3, $4)
     on conflict (email) do nothing`,
    [email, await hashPassword('password123'), fullName, role],
  );
}
console.log('Демо-пользователи готовы (пароль у всех: password123)');

await db.end();
