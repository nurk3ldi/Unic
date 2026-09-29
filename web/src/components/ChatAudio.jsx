import { useRef, useState } from 'react';
import {
  IconMicSolid,
  IconPause,
  IconPlay,
} from '../icons.jsx';
import { extensionOf, formatDuration, formatSize } from '../chat.js';
import { authorColor, initial } from '../people.js';
import './ChatAudio.css';

// Играет что-то одно: запустили новое — остальные встают на паузу, как в мессенджерах
if (typeof document !== 'undefined') {
  document.addEventListener(
    'play',
    (event) => {
      if (!(event.target instanceof HTMLAudioElement)) return;
      document.querySelectorAll('audio').forEach((audio) => audio !== event.target && audio.pause());
    },
    true,
  );
}

// Сколько столбиков рисуется у голосового
const BARS = 40;

/** Волна голосового → ровно BARS столбиков (0…31). Нет волны — ровный ряд. */
function toBars(waveform) {
  if (!waveform?.length) return Array(BARS).fill(10);
  return Array.from({ length: BARS }, (_, index) => {
    const at = Math.floor((index / BARS) * waveform.length);
    return waveform[at];
  });
}

/**
 * Аудио в ленте. Голосовое — как в WhatsApp: слева аватар того, кто говорил, с
 * меткой микрофона в углу; ▶ без подложки; «волна» с круглой ручкой на месте,
 * где сейчас играет (пройденное закрашено, по волне можно перемотать); под ней
 * слева длительность, справа время. Аудиофайл — ▶ в круге, имя и полоса хода.
 * Не открылось в этом браузере — показываем `fallback` («не открывается, скачайте»).
 *
 * `author` — { id, name, photo? }: чей голос. Нет автора (раздел «Медиа») — без аватара.
 */
export default function ChatAudio({ file, time, fallback, author }) {
  const audioRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(file.duration ?? 0);

  if (failed) return fallback ?? null;

  const voice = file.kind === 'voice';
  const progress = duration ? Math.min(current / duration, 1) : 0;

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => setFailed(true));
    else audio.pause();
  }

  /** Перемотка нажатием по волне или полосе: доля ширины — доля записи. */
  function seek(event) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    const share = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    audio.currentTime = share * duration;
    setCurrent(audio.currentTime);
    if (audio.paused) audio.play().catch(() => setFailed(true));
  }

  return (
    <div className={`audio${voice ? ' audio--voice' : ''}`}>
      <audio
        ref={audioRef}
        src={file.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          // У записи из Chrome длительность бывает Infinity — тогда верим своей
          const real = event.currentTarget.duration;
          if (Number.isFinite(real) && real > 0) setDuration(real);
        }}
        onError={() => setFailed(true)}
      />

      {voice && author && (
        /* Кто говорит — сразу видно, не читая шапку; микрофон отличает голос от файла */
        <span className="audio__avatar" style={{ '--author': authorColor(author.id) }}>
          {author.photo ? (
            <img src={author.photo} alt="" />
          ) : (
            <span aria-hidden="true">{initial(author.name)}</span>
          )}
          <IconMicSolid className="audio__avatar-mic" aria-hidden="true" />
        </span>
      )}

      <button
        className="audio__play"
        type="button"
        aria-label={playing ? 'Пауза' : voice ? 'Слушать голосовое' : `Слушать: ${file.name}`}
        onClick={toggle}
      >
        {playing ? (
          <IconPause aria-hidden="true" />
        ) : (
          <IconPlay className="audio__play-icon" aria-hidden="true" />
        )}
      </button>

      <span className="audio__body">
        {voice ? (
          <button className="audio__wave" type="button" aria-label="Перемотать" onClick={seek}>
            {toBars(file.waveform).map((height, index) => (
              <span
                key={index}
                className={`audio__bar${index / BARS < progress ? ' is-played' : ''}`}
                style={{ '--h': height }}
              />
            ))}
            {/* Ручка — там, где сейчас играет; едет вместе с временем */}
            <span className="audio__knob" style={{ left: `${progress * 100}%` }} aria-hidden="true" />
          </button>
        ) : (
          <>
            <span className="audio__name" title={file.name}>
              {file.name}
            </span>
            <button className="audio__track" type="button" aria-label="Перемотать" onClick={seek}>
              <span style={{ transform: `scaleX(${progress})` }} />
            </button>
          </>
        )}

        <span className="audio__meta">
          {/* Идёт — сколько прошло; стоит — сколько всего */}
          {formatDuration(playing || current > 0 ? current : duration)}
          {!voice && ` · ${extensionOf(file.name).toUpperCase()} · ${formatSize(file.size)}`}
          {time}
        </span>
      </span>
    </div>
  );
}
