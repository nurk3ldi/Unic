import { useEffect, useRef, useState } from 'react';

/**
 * Живые события чата: сервер сам говорит, что появилось новое сообщение или
 * что кто-то набирает текст (`/api/stream`, SSE).
 *
 * **Одно соединение на вкладку.** Событий мало, а каждое подключение занимает
 * один из шести HTTP-каналов, которые браузер даёт сайту. Поэтому источник
 * общий, а компоненты просто подписываются на него.
 *
 * Обрыв связи браузер чинит сам — своего кода переподключения здесь нет.
 */

let source = null;
const handlers = new Set(); // кому передавать события
const watchers = new Set(); // кто следит за самим соединением
let alive = false;

function setAlive(next) {
  if (alive === next) return;
  alive = next;
  watchers.forEach((watch) => watch(alive));
}

function open() {
  if (source) return;

  source = new EventSource('/api/stream');
  source.onopen = () => setAlive(true);
  // Браузер переподключится сам; нам важно лишь знать, что сейчас связи нет —
  // пока её нет, опрос идёт часто
  source.onerror = () => setAlive(false);
  source.onmessage = (message) => {
    let event;
    try {
      event = JSON.parse(message.data);
    } catch {
      return;
    }
    handlers.forEach((handle) => handle(event));
  };
}

function close() {
  // Последний слушатель ушёл — держать соединение незачем
  if (!source || handlers.size) return;
  source.close();
  source = null;
  setAlive(false);
}

/**
 * Слушать события. Возвращает, живо ли соединение: пока живо, опрос можно
 * вести редко — он остаётся только страховкой.
 */
export function useLive(onEvent) {
  const [connected, setConnected] = useState(alive);
  // Обработчик пересоздаётся на каждый рендер — подписку держим на ref,
  // иначе пришлось бы переподписываться и дёргать соединение
  const latest = useRef(onEvent);
  latest.current = onEvent;

  useEffect(() => {
    const handle = (event) => latest.current?.(event);
    handlers.add(handle);
    watchers.add(setConnected);
    open();

    return () => {
      handlers.delete(handle);
      watchers.delete(setConnected);
      close();
    };
  }, []);

  return connected;
}
