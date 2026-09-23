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
  ['admin@unic.kz', 'admin', '+77010000001', 'Админ Системы', 'admin'],
  ['university@unic.kz', 'kbtu', '+77010000002', 'Университет KBTU', 'university'],
  ['nurk3ldi@icloud.com', 'nurkeldi', '+77010000003', 'Ақжігіт Нұркелді Мұхаметжанұлы', 'club_lead'],
  ['ftnurkeldi@gmail.com', 'aruzhan', '+77010000004', 'Тұрғанова Аружан Асқарқызы', 'student'],
];

for (const [email, username, phone, fullName, role] of demo) {
  await db.query(
    `insert into users (email, username, phone, password_hash, full_name, role)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (email) do nothing`,
    [email, username, phone, await hashPassword('password123'), fullName, role],
  );
}
console.log('Демо-пользователи готовы (пароль у всех: password123)');

await db.end();
