import { useEffect, useRef, useState } from 'react';
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconChats,
  IconCopy,
  IconDownload,
  IconDots,
  IconHeart,
  IconPause,
  IconPlay,
  IconTrash,
  IconVolume,
  IconVolumeOff,
} from '../icons.jsx';
import { formatDuration } from '../chat.js';
import { initial } from '../people.js';
import { api } from '../api.js';
import logo from '../assets/logo.png';
import './PhotoViewer.css';

// Скорости по кругу — как в плеере iOS: одна кнопка, нажатие даёт следующую
const RATES = [1, 1.5, 2];
// Сколько панель видна после последнего движения мыши, пока видео играет
const IDLE_MS = 2500;
// Шаг перемотки стрелками
const SEEK_STEP = 5;
// Сколько стоит снимок в серии, прежде чем уйти к следующему — как в Instagram
const STEP_MS = 5000;

/**
 * Снимок или видео на весь экран поверх страницы. Нативный <dialog>: Esc, фокус и
 * верхний слой даёт платформа. Клик мимо — тоже выход: так закрывают любое окно.
 * Нужен и ленте, и разделу «Медиа», поэтому живёт отдельно.
 * `photo` — { url } снимка или { url, kind: 'video', name? } видео.
 * `steps` — необязательно, для серии (истории): { index, count, onPrev, onNext } —
 * сверху полоски «который из скольких», по бокам ‹ ›; у снимка листают и ← →.
 * Серия идёт сама: снимок — через 5 секунд, видео — когда доиграло.
 */
export default function PhotoViewer({ photo, onClose, steps, teller, onDelete, onLike }) {
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  // Окно держит последний снимок, пока растворяется, — иначе он пропал бы раньше окна
  const shown = useRef(null);
  const series = useRef(null);
  const wasOpen = useRef(false);
  const session = useRef(0);
  const [storyMuted, setStoryMuted] = useState(true);
  if (photo && !wasOpen.current) session.current += 1;
  wasOpen.current = Boolean(photo);
  if (photo) {
    shown.current = photo;
    series.current = { teller, steps };
  }
  const storyMode = Boolean(series.current?.teller);
  const isOpen = Boolean(photo);

  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previous; };
  }, [isOpen]);

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

  // ← → листают серию, но только у снимка: у видео эти клавиши перематывают
  useEffect(() => {
    if (!photo || !steps || teller || photo.kind === 'video') return;
    function onKey(event) {
      if (event.key === 'ArrowLeft') steps.onPrev?.();
      else if (event.key === 'ArrowRight') steps.onNext?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [photo, steps, teller]);

  // Снимок в серии уходит сам. Таймер в JS, а не конец CSS-анимации: при
  // «Уменьшить движение» анимации сжимаются до нуля — серия пролетела бы разом
  useEffect(() => {
    if (!photo || !steps?.onNext || teller || photo.kind === 'video') return;
    const timer = setTimeout(steps.onNext, STEP_MS);
    return () => clearTimeout(timer);
  }, [photo, steps, teller]);

  return (
    <dialog
      className={`photo-viewer${storyMode ? ' photo-viewer--story' : ''}`}
      ref={dialogRef}
      aria-label={storyMode ? 'Просмотр истории' : shown.current?.kind === 'video' ? 'Просмотр видео' : 'Просмотр фото'}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {storyMode ? (
        <StoryPlayer
          key={`${shown.current.id}:${session.current}`}
          media={shown.current}
          teller={series.current.teller}
          steps={series.current.steps}
          active={Boolean(photo)}
          muted={storyMuted}
          onMute={() => setStoryMuted((value) => !value)}
          onDelete={onDelete}
          onLike={onLike}
        />
      ) : shown.current?.kind === 'video' ? (
        // Ключ — адрес: другое видео начинается с нуля, а не с чужой позиции
        <VideoPlayer
          key={shown.current.url}
          media={shown.current}
          videoRef={videoRef}
          onEnded={steps?.onNext}
        />
      ) : (
        shown.current && <img className="photo-viewer__image" src={shown.current.url} alt="" />
      )}

      {steps && !storyMode && (
        <>
          {/* Идущая полоска заполняется за время кадра: снимок — 5 секунд, видео —
              его длина. Ключ — адрес: новый кадр начинает полоску с нуля */}
          <div className="photo-viewer__steps" aria-label={`${steps.index + 1} из ${steps.count}`}>
            {Array.from({ length: steps.count }, (_, index) => (
              <span
                key={index === steps.index ? shown.current?.url : index}
                className={`photo-viewer__step${
                  index < steps.index
                    ? ' photo-viewer__step--done'
                    : index === steps.index
                      ? ' photo-viewer__step--now'
                      : ''
                }`}
                style={
                  index === steps.index
                    ? {
                        '--step-time':
                          shown.current?.kind === 'video' && shown.current.duration
                            ? `${shown.current.duration}s`
                            : `${STEP_MS}ms`,
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {/* Крайняя стрелка не пропадает, а гаснет — ряд не прыгает */}
          <button
            className="photo-viewer__turn photo-viewer__turn--prev"
            type="button"
            aria-label="Предыдущая"
            disabled={!steps.onPrev}
            onClick={steps.onPrev}
          >
            <IconChevronLeft aria-hidden="true" />
          </button>
          <button
            className="photo-viewer__turn photo-viewer__turn--next"
            type="button"
            aria-label="Следующая"
            disabled={!steps.onNext}
            onClick={steps.onNext}
          >
            <IconChevronRight aria-hidden="true" />
          </button>
        </>
      )}

      {/* Знак из шапки: в историях видно, чьё это окно, — как у Instagram */}
      {storyMode && <img className="photo-viewer__logo" src={logo} alt="Unic" />}

      <button className="photo-viewer__close" type="button" aria-label="Закрыть" onClick={onClose}>
        {/* Контурный знак, а не залитый: толщину штриха можно задать */}
        <IconClose aria-hidden="true" />
      </button>
    </dialog>
  );
}

function storyAge(iso) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  return minutes < 1 ? 'Только что' : minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч`;
}

/** История всегда в кадре 9:16. Прогресс идёт по реальному времени медиа,
 * а пауза, меню и скрытая вкладка останавливают и кадр, и полоску. */
function StoryPlayer({ media, teller, steps, active, muted, onMute, onDelete, onLike }) {
  const videoRef = useRef(null);
  const fillRef = useRef(null);
  const elapsed = useRef(0);
  const next = useRef(steps.onNext);
  next.current = steps.onNext;
  const pressAt = useRef(0);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [buffering, setBuffering] = useState(false);
  const [menu, setMenu] = useState(false);
  const [liked, setLiked] = useState(Boolean(media.liked));
  const [liking, setLiking] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const isVideo = media.kind === 'video';
  const stopped = !active || paused || holding || hidden || menu;

  function closeMenu() {
    setMenu(false);
    menuButtonRef.current?.focus();
  }

  useEffect(() => {
    if (menu) menuRef.current?.querySelector('button')?.focus();
  }, [menu]);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!active) return;
    function onKey(event) {
      if (menu) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMenu();
        }
        return;
      }
      if (event.target.closest?.('input, textarea')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); steps.onPrev?.(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); steps.onNext?.(); }
      else if (event.code === 'Space' && !event.target.closest?.('button, a')) { event.preventDefault(); setPaused((value) => !value); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, steps, menu]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stopped || !ready) video.pause();
    else video.play().catch((error) => {
      if (error.name === 'NotAllowedError') setPaused(true);
    });
  }, [stopped, ready]);

  useEffect(() => {
    if (stopped || !ready || buffering) return;
    let frame;
    let previous = performance.now();
    const tick = (now) => {
      let progress;
      if (isVideo) {
        const video = videoRef.current;
        if (!video) return; // Кадр сменился до очистки эффекта.
        const duration = Number.isFinite(video?.duration) ? video.duration : media.duration;
        progress = duration > 0 ? video.currentTime / duration : 0;
      } else {
        elapsed.current += now - previous;
        progress = elapsed.current / STEP_MS;
      }
      previous = now;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${Math.min(1, progress)})`;
      if (!isVideo && progress >= 1) next.current?.();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stopped, ready, buffering, isVideo, media.duration]);

  function mediaError() {
    setPaused(true);
    setFailure('Не удалось открыть историю. Попробуйте следующую.');
  }

  async function like() {
    if (liking) return;
    setLiking(true);
    setFailure('');
    try {
      const result = await api.likeStory(media.id, !liked);
      setLiked(result.liked);
      onLike?.(media.id, result.liked);
    } catch (error) { setFailure(error.message); }
    finally { setLiking(false); }
  }

  async function copyLink() {
    closeMenu();
    setPaused(true);
    setFailure('');
    setNotice('');
    const url = new URL(`/?story=${media.id}`, location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Ссылка скопирована');
    } catch {
      setFailure('Не удалось скопировать ссылку');
    }
  }

  async function share() {
    if (!navigator.share) return copyLink();
    closeMenu();
    setPaused(true);
    setFailure('');
    setNotice('');
    try {
      await navigator.share({ title: `История: ${teller.name}`, url: new URL(`/?story=${media.id}`, location.origin).href });
    } catch (error) {
      if (error.name !== 'AbortError') setFailure('Не удалось поделиться ссылкой');
    }
  }

  function menuKeys(event) {
    const buttons = [...menuRef.current.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].focus();
  }

  async function remove() {
    if (!window.confirm('Удалить эту историю?')) return;
    setFailure('');
    try { await onDelete(media.id); }
    catch (error) { setFailure(error.message); }
  }

  const press = (event) => {
    pressAt.current = performance.now();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHolding(true);
  };
  const release = (turn) => () => {
    setHolding(false);
    if (performance.now() - pressAt.current < 250) turn?.();
  };

  return (
    <div className="story-player">
      {isVideo ? (
        <video className="story-player__media" src={media.url} ref={videoRef} playsInline muted={muted}
          onLoadedMetadata={() => setReady(true)} onCanPlay={() => setBuffering(false)}
          onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)}
          onEnded={() => !stopped && next.current?.()} onError={mediaError} />
      ) : (
        <img className="story-player__media" src={media.url} alt={`История: ${teller.name}`}
          onLoad={() => setReady(true)} onError={mediaError} />
      )}

      <button className="story-player__tap story-player__tap--prev" type="button"
        aria-label="Предыдущая история" aria-disabled={!steps.onPrev}
        onPointerDown={press} onPointerUp={release(steps.onPrev)} onPointerCancel={() => setHolding(false)}
        onClick={(event) => event.detail === 0 && steps.onPrev?.()} />
      <button className="story-player__tap story-player__tap--next" type="button"
        aria-label="Следующая история" onPointerDown={press} onPointerUp={release(steps.onNext)}
        onPointerCancel={() => setHolding(false)} onClick={(event) => event.detail === 0 && steps.onNext?.()} />

      <div className="story-player__top">
        <div className="story-player__progress" aria-label={`${steps.index + 1} из ${steps.count}`}>
          {Array.from({ length: steps.count }, (_, index) => (
            <span className="story-player__step" key={index}>
              <span className={`story-player__fill${index < steps.index ? ' story-player__fill--done' : ''}`}
                ref={index === steps.index ? fillRef : null} />
            </span>
          ))}
        </div>
        <div className="story-player__header">
          <span className="story-player__avatar">
            {teller.photo ? <img src={teller.photo} alt="" /> : initial(teller.name)}
          </span>
          <div className="story-player__author">
            <strong>{teller.name}</strong>
            <time dateTime={media.createdAt}>{storyAge(media.createdAt)}</time>
          </div>
          {isVideo && <button className="story-player__button" type="button" onClick={onMute}
            aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
            {muted ? <IconVolumeOff /> : <IconVolume />}
          </button>}
          <button className="story-player__button" type="button" onClick={() => setPaused((value) => !value)}
            aria-label={paused ? 'Продолжить историю' : 'Пауза'}>
            {paused ? <IconPlay /> : <IconPause />}
          </button>
          <button className="story-player__button" ref={menuButtonRef} type="button" onClick={() => setMenu((value) => !value)}
            aria-label="Действия с историей" aria-haspopup="menu" aria-expanded={menu}><IconDots /></button>
        </div>
      </div>

      {menu && <>
        <button className="story-player__menu-dismiss" type="button" tabIndex={-1}
          aria-label="Закрыть меню истории" onClick={closeMenu} />
        <div className="story-player__menu" ref={menuRef} role="menu" aria-label="Действия с историей" onKeyDown={menuKeys}>
          <button type="button" role="menuitem" onClick={share}><IconChats aria-hidden="true" /><span>Поделиться</span></button>
          <button type="button" role="menuitem" onClick={copyLink}><IconCopy aria-hidden="true" /><span>Копировать ссылку</span></button>
          {media.canDelete && <button className="story-player__delete" type="button" role="menuitem" onClick={remove}>
            <IconTrash aria-hidden="true" /><span>Удалить историю</span>
          </button>}
        </div>
      </>}

      <div className="story-player__bottom">
        {(failure || notice) && <p className="story-player__notice" role={failure ? 'alert' : 'status'}>{failure || notice}</p>}
        <div className="story-player__actions">
          <button className={`story-player__button${liked ? ' story-player__button--liked' : ''}`}
            type="button" aria-label={liked ? 'Убрать лайк' : 'Нравится'} aria-pressed={liked} disabled={liking} onClick={like}><IconHeart /></button>
        </div>
      </div>
    </div>
  );
}

/**
 * Свой плеер вместо системных кнопок браузера: у Chrome они серые, со своим «⋮»
 * и в каждом браузере разные. Здесь — как в «Фото» на iPhone: видео на чёрном,
 * внизу плавающая панель из тёмного материала. Пока видео играет, панель
 * через пару секунд уходит и возвращается от движения мыши; на паузе — видна.
 * Клавиши: пробел — пауза, ← → — ±5 секунд.
 */
function VideoPlayer({ media, videoRef, onEnded }) {
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
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
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
          {playing ? <IconPause aria-hidden="true" /> : <IconPlay aria-hidden="true" />}
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
            <IconVolumeOff aria-hidden="true" />
          ) : (
            <IconVolume aria-hidden="true" />
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
          <IconDownload aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
