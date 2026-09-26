import { useEffect, useRef, useState } from 'react';
import {
  IoCloseOutline,
  IoDownloadOutline,
  IoPause,
  IoPlay,
  IoVolumeHighOutline,
  IoVolumeMuteOutline,
} from 'react-icons/io5';
import { formatDuration } from '../chat.js';
import './PhotoViewer.css';

// Скорости по кругу — как в плеере iOS: одна кнопка, нажатие даёт следующую
const RATES = [1, 1.5, 2];
// Сколько панель видна после последнего движения мыши, пока видео играет
const IDLE_MS = 2500;
// Шаг перемотки стрелками
const SEEK_STEP = 5;

/**
 * Снимок или видео на весь экран поверх страницы. Нативный <dialog>: Esc, фокус и
 * верхний слой даёт платформа. Клик мимо — тоже выход: так закрывают любое окно.
 * Нужен и ленте, и разделу «Медиа», поэтому живёт отдельно.
 * `photo` — { url } снимка или { url, kind: 'video', name? } видео.
 */
export default function PhotoViewer({ photo, onClose }) {
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  // Окно держит последний снимок, пока растворяется, — иначе он пропал бы раньше окна
  const shown = useRef(null);
  if (photo) shown.current = photo;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (photo && !dialog.open) dialog.showModal();
    if (!photo && dialog.open) {
      // Окно ещё растворяется, а звук уже не нужен
      videoRef.current?.pause();
      dialog.close();
    }
  }, [photo]);

  return (
    <dialog
      className="photo-viewer"
      ref={dialogRef}
      aria-label={shown.current?.kind === 'video' ? 'Просмотр видео' : 'Просмотр фото'}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {shown.current?.kind === 'video' ? (
        // Ключ — адрес: другое видео начинается с нуля, а не с чужой позиции
        <VideoPlayer key={shown.current.url} media={shown.current} videoRef={videoRef} />
      ) : (
        shown.current && <img className="photo-viewer__image" src={shown.current.url} alt="" />
      )}

      <button className="photo-viewer__close" type="button" aria-label="Закрыть" onClick={onClose}>
        {/* Контурный знак, а не залитый: толщину штриха можно задать */}
        <IoCloseOutline aria-hidden="true" />
      </button>
    </dialog>
  );
}

/**
 * Свой плеер вместо системных кнопок браузера: у Chrome они серые, со своим «⋮»
 * и в каждом браузере разные. Здесь — как в «Фото» на iPhone: видео на чёрном,
 * внизу плавающая панель из тёмного материала. Пока видео играет, панель
 * через пару секунд уходит и возвращается от движения мыши; на паузе — видна.
 * Клавиши: пробел — пауза, ← → — ±5 секунд.
 */
function VideoPlayer({ media, videoRef }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(media.duration ?? 0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef(null);

  const video = () => videoRef.current;

  function toggle() {
    const element = video();
    if (!element) return;
    if (element.paused) element.play().catch(() => {});
    else element.pause();
  }

  function seek(to) {
    const element = video();
    if (!element || !Number.isFinite(to)) return;
    element.currentTime = Math.min(Math.max(to, 0), element.duration || to);
    setCurrent(element.currentTime);
  }

  // Движение мыши — панель возвращается и снова ждёт тишины
  function wake() {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  }

  // Движение мыши где угодно в окне будит панель
  useEffect(() => {
    document.addEventListener('pointermove', wake);
    return () => {
      document.removeEventListener('pointermove', wake);
      clearTimeout(idleTimer.current);
    };
  }, []);

  // Клавиши — пока открыт плеер. Esc закрывает окно сам (<dialog>)
  useEffect(() => {
    function onKey(event) {
      if (event.target.closest?.('input')) return; // ползунок двигают стрелками сам
      if (event.code === 'Space') {
        event.preventDefault();
        toggle();
      } else if (event.key === 'ArrowRight') seek((video()?.currentTime ?? 0) + SEEK_STEP);
      else if (event.key === 'ArrowLeft') seek((video()?.currentTime ?? 0) - SEEK_STEP);
      else return;
      wake();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const progress = duration ? (current / duration) * 100 : 0;
  // На паузе панель не прячется: смотрят на кадр и решают, что дальше
  const hidden = playing && idle;

  return (
    // Обёртка без своей коробки (display: contents): клик мимо видео и панели
    // попадает в само окно и закрывает его, как у снимка
    <div className={`player${hidden ? ' player--idle' : ''}`}>
      <video
        ref={videoRef}
        className="photo-viewer__image player__video"
        src={media.url}
        autoPlay
        playsInline
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          wake();
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />

      <div className="player__bar">
        <button
          className="player__button player__button--play"
          type="button"
          aria-label={playing ? 'Пауза' : 'Смотреть'}
          onClick={toggle}
        >
          {playing ? <IoPause aria-hidden="true" /> : <IoPlay aria-hidden="true" />}
        </button>

        <span className="player__time">{formatDuration(current)}</span>

        {/* Ползунок — системный range: клавиатура и скринридер работают сами.
            Пройденная часть закрашивается через --progress */}
        <input
          className="player__scrubber"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          aria-label="Позиция в видео"
          style={{ '--progress': `${progress}%` }}
          onChange={(event) => seek(Number(event.target.value))}
        />

        <span className="player__time">{formatDuration(duration)}</span>

        <button
          className="player__button"
          type="button"
          aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          onClick={() => {
            const element = video();
            if (element) element.muted = !element.muted;
          }}
        >
          {muted ? (
            <IoVolumeMuteOutline aria-hidden="true" />
          ) : (
            <IoVolumeHighOutline aria-hidden="true" />
          )}
        </button>

        <button
          className="player__button player__rate"
          type="button"
          aria-label={`Скорость: ${rate}×`}
          onClick={() => {
            const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
            if (video()) video().playbackRate = next;
            setRate(next);
          }}
        >
          {String(rate).replace('.', ',')}×
        </button>

        <a
          className="player__button"
          href={media.url}
          download={media.name ?? ''}
          aria-label="Скачать видео"
        >
          <IoDownloadOutline aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
