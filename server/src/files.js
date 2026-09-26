import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

/**
 * Вложения чата — видео и документы — лежат на диске, а не в базе: в строку
 * data URL они не помещаются (тело JSON ограничено 1 MB), а база не место
 * для сотен мегабайт. В базе — только сведения (chat_files), файл назван его id.
 *
 * Своего пакета для загрузки нет: тело запроса пишется на диск потоком
 * (stdlib), размер считается на лету — лишнее не ложится ни в память, ни на диск.
 */
export const UPLOAD_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
await mkdir(UPLOAD_DIR, { recursive: true });

export const filePath = (id) => join(UPLOAD_DIR, id);

export const VIDEO_LIMIT = 100 * 1024 * 1024;
export const DOCUMENT_LIMIT = 25 * 1024 * 1024;
export const IMAGE_LIMIT = 25 * 1024 * 1024;

// Тип решает сервер — по расширению из белого списка, а не по заголовку
// браузера. Отдаём файл с этим же типом: чужого «text/html» не бывает
const VIDEO_TYPES = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  // MOV с iPhone чаще в HEVC: Safari играет, Chrome на Windows — нет. Принимаем
  // всё равно; где не играет, лента скажет это сама (web/src/components/ChatRoom.jsx)
  mov: 'video/quicktime',
};

// Снимки Apple (HEIC/HEIF) — оригиналом. Браузер, который их читает (Safari),
// сам переводит снимок в JPEG до отправки; оригинал уходит только из того,
// что прочитать не смог. Показывает его тоже только тот, кто умеет
const IMAGE_TYPES = {
  heic: 'image/heic',
  heif: 'image/heif',
};

const DOCUMENT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  // iWork: в браузере не открываются нигде — только скачать
  pages: 'application/vnd.apple.pages',
  numbers: 'application/vnd.apple.numbers',
  key: 'application/vnd.apple.keynote',
};

/** Что это за файл: вид, тип для отдачи и предел размера. Неизвестное — null. */
export function classify(name) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (VIDEO_TYPES[ext]) return { kind: 'video', mime: VIDEO_TYPES[ext], limit: VIDEO_LIMIT };
  if (IMAGE_TYPES[ext]) return { kind: 'image', mime: IMAGE_TYPES[ext], limit: IMAGE_LIMIT };
  if (DOCUMENT_TYPES[ext]) {
    return { kind: 'document', mime: DOCUMENT_TYPES[ext], limit: DOCUMENT_LIMIT };
  }
  return null;
}

/** Имя для показа: без пути, без управляющих символов, разумной длины. */
export function cleanName(raw) {
  const name = String(raw ?? '')
    .split(/[\\/]/)
    .pop()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return name.slice(-200);
}

export class TooLarge extends Error {}

/**
 * Пишет тело запроса в файл, считая байты. Сверх предела на диск уже ничего не
 * пишется, но тело дочитывается: иначе соединение рвётся посреди отправки и
 * клиент вместо внятного «слишком большой» видит обрыв сети. Совсем чрезмерное
 * (вчетверо больше предела) не дочитываем — обрываем.
 */
export async function saveBody(req, id, limit) {
  let size = 0;
  const counter = new Transform({
    transform(chunk, _encoding, done) {
      size += chunk.length;
      if (size > limit * 4) return done(new TooLarge());
      done(null, size > limit ? undefined : chunk);
    },
  });

  try {
    await pipeline(req, counter, createWriteStream(filePath(id)));
  } catch (failure) {
    await removeFile(id);
    throw failure;
  }
  if (size > limit) {
    await removeFile(id);
    throw new TooLarge();
  }
  return size;
}

/** Отказ до чтения тела — но ответ уходит, когда тело дочитано (см. saveBody). */
export function rejectAfterBody(req, send) {
  req.resume();
  req.once('end', send);
}

/** Стирает файл с диска; уже стёртый — не ошибка. */
export async function removeFile(id) {
  await unlink(filePath(id)).catch(() => {});
}
