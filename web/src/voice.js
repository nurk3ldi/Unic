import { useEffect, useRef, useState } from 'react';

/**
 * Голосовое сообщение: запись с микрофона средствами браузера (MediaRecorder),
 * без пакетов. Формат — какой умеет браузер: MP4 (Safari и свежий Chrome —
 * перематывается и играет везде), иначе WebM с Opus.
 */

// Можно ли вообще записывать: нет API (старый браузер, не https) — кнопки микрофона нет
export const canRecord =
  typeof window !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window.MediaRecorder !== 'undefined';

// Порядок — по удобству: MP4 перематывается и открывается в Safari, WebM — запасной
const FORMATS = [
  ['audio/mp4', 'm4a'],
  ['audio/webm;codecs=opus', 'weba'],
  ['audio/webm', 'weba'],
];

// Дольше — это уже не реплика: запись останавливается сама
export const VOICE_LIMIT_S = 5 * 60;
// Сколько столбиков «волны» уходит на сервер и рисуется в ленте
const WAVE_BARS = 48;
// Как часто меряем громкость, пока пишем
const TICK_MS = 100;

/** Сжать ряд громкостей до `count` столбиков 0…31 — «волна» голосового. */
function toWaveform(levels, count = WAVE_BARS) {
  if (!levels.length) return [];
  const bucket = levels.length / count;
  const raw = Array.from({ length: count }, (_, index) => {
    const from = Math.floor(index * bucket);
    const to = Math.max(from + 1, Math.floor((index + 1) * bucket));
    const slice = levels.slice(from, to);
    return slice.length ? Math.max(...slice) : 0;
  });
  const peak = Math.max(...raw);
  // Тишина (анализатор не завёлся): волны нет вовсе — лента нарисует ровный
  // ряд, и это честнее, чем черта из минимальных столбиков
  if (!peak) return [];
  // Корень выравнивает шкалу: без него один громкий слог делает остальную речь
  // плоской. Тишина — невысокий, но видимый столбик: ряд не рвётся на пустые места
  return raw.map((value) => Math.max(3, Math.round(Math.sqrt(value / peak) * 31)));
}

/**
 * Запись голосового. Отдаёт состояние (идёт ли запись, сколько секунд, живые
 * уровни для столбиков) и три действия: начать, закончить (вернёт файл,
 * длительность и волну) и отменить. Микрофон отпускается сразу после записи —
 * красная точка в браузере не висит.
 */
export function useVoiceRecorder({ onLimit } = {}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState([]);
  const session = useRef(null);
  const onLimitRef = useRef(onLimit);
  onLimitRef.current = onLimit;

  function release() {
    const current = session.current;
    if (!current) return;
    clearInterval(current.timer);
    current.stream.getTracks().forEach((track) => track.stop());
    current.context?.close().catch(() => {});
    session.current = null;
    setRecording(false);
    setElapsed(0);
    setLevels([]);
  }

  // Ушли со страницы посреди записи — микрофон не остаётся включённым
  useEffect(() => release, []);

  async function start() {
    if (session.current) return;
    // Просит разрешение сам браузер; отказ — исключение, его покажет вызывающий
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const [mimeType, ext] = FORMATS.find(([type]) => MediaRecorder.isTypeSupported(type)) ?? [
      '',
      'weba',
    ];
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);

    // Громкость — по ходу записи: из неё и живые столбики, и «волна» в ленте
    let context = null;
    let analyser = null;
    try {
      context = new AudioContext();
      // Контекст рождается остановленным: пока ждали разрешения на микрофон,
      // жест пользователя «протух». Остановленный анализатор отдаёт тишину —
      // и волна выходит ровной чертой, как будто записи и не было
      if (context.state === 'suspended') await context.resume();
      analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
    } catch {
      // без анализатора запись всё равно идёт — просто без волны
    }
    const buffer = analyser ? new Uint8Array(analyser.fftSize) : null;
    const all = [];
    const startedAt = performance.now();

    const timer = setInterval(() => {
      let level = 0;
      if (analyser) {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += ((sample - 128) / 128) ** 2;
        level = Math.sqrt(sum / buffer.length);
      }
      all.push(level);
      setLevels((was) => [...was.slice(-39), level]);
      const seconds = (performance.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= VOICE_LIMIT_S) onLimitRef.current?.();
    }, TICK_MS);

    session.current = { stream, recorder, chunks, context, timer, all, startedAt, ext, mimeType };
    recorder.start(250);
    setRecording(true);
  }

  /** Закончить запись: файл, длительность (с) и волна. */
  function finish() {
    const current = session.current;
    if (!current) return Promise.resolve(null);
    return new Promise((resolve) => {
      current.recorder.onstop = () => {
        const duration = (performance.now() - current.startedAt) / 1000;
        const type = current.recorder.mimeType || current.mimeType || 'audio/webm';
        const blob = new Blob(current.chunks, { type });
        const file = new File([blob], `Голосовое сообщение.${current.ext}`, { type });
        const waveform = toWaveform(current.all);
        release();
        resolve({ file, duration, waveform });
      };
      current.recorder.stop();
    });
  }

  /** Отменить: записанное выбрасывается, микрофон отпускается. */
  function cancel() {
    const current = session.current;
    if (!current) return;
    current.recorder.onstop = null;
    if (current.recorder.state !== 'inactive') current.recorder.stop();
    release();
  }

  return { recording, elapsed, levels, start, finish, cancel };
}
