import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { IconChevronLeft, IconChevronRight, IconPlus } from '../icons.jsx';
import { initial } from '../people.js';
import PhotoViewer from './PhotoViewer.jsx';
import './StoryRail.css';

// Сколько карточек видно в ряду разом, считая «Добавить». Число уходит в сетку
// (`--cards`): от него ширина карточки. Остальные — за краем, их листают стрелками.
// Кто выложил раньше, тот и левее
const CARDS = 5;

/** Размеры видео — до отправки: сервер сам их не считает, а лента ставит кадр по ним. */
async function videoMeta(file) {
  if (!file.type.startsWith('video/')) return {};

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
    };
    video.onerror = () => resolve({});
    video.src = URL.createObjectURL(file);
  });
}

/** Обложка карточки: у видео — первый кадр, его же берёт и лента чата. */
function Cover({ item }) {
  if (item.kind === 'video') {
    return <video className="story__cover" src={`${item.url}#t=0.1`} muted playsInline />;
  }
  return <img className="story__cover" src={item.url} alt="" />;
}

/**
 * Истории: ряд карточек над лентой. Публикуют только клуб (его руководитель) и
 * университет — у остальных карточки «Добавить» просто нет. История живёт сутки.
 *
 * Карточки сгруппированы по рассказчику: у клуба может быть несколько историй,
 * в ряду он один. Открывается пока первая — листание сделаем, когда историй
 * станет больше одной у кого-то.
 */
export default function StoryRail() {
  const [tellers, setTellers] = useState([]);
  const [targets, setTargets] = useState([]);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const railRef = useRef(null);
  // Есть ли куда листать — стрелка показывается только в ту сторону, где что-то есть
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  // От чьего имени выкладываем: выбирается до того, как открылось окно файла
  const target = useRef(null);

  const load = useCallback(() => {
    api
      .stories()
      .then(({ tellers, targets }) => {
        setTellers(tellers);
        setTargets(targets);
      })
      .catch(() => {
        // Молча: ряд историй — не место для ошибок сети
      });
  }, []);

  useEffect(load, [load]);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    // Допуск в пиксель: при дробной ширине карточек scrollLeft не доходит до края ровно
    const end = rail.scrollWidth - rail.clientWidth;
    setAtStart(rail.scrollLeft <= 1);
    setAtEnd(rail.scrollLeft >= end - 1);
  }, []);

  // Пересчёт, когда меняется число карточек или ширина ряда (окно, столбцы)
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [measure, tellers.length, targets.length]);

  /** Листает ряд на ширину экрана: пять карточек уходят, пять новых приходят. */
  function page(direction) {
    const rail = railRef.current;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.scrollBy({ left: direction * rail.clientWidth, behavior: still ? 'auto' : 'smooth' });
  }

  function pick(chosen) {
    target.current = chosen;
    setError('');
    fileRef.current.click();
  }

  async function send(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // тот же файл можно выбрать снова
    if (!file) return;

    setBusy(true);
    try {
      await api.uploadStory(file, target.current?.club ?? null, await videoMeta(file));
      load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  // Ни историй, ни права публиковать — ряда нет совсем
  if (!tellers.length && !targets.length) return null;

  const canAdd = targets.length > 0;

  return (
    <>
      <div className="stories-box">
        <div className="stories" ref={railRef} onScroll={measure} style={{ '--cards': CARDS }}>
          {canAdd && (
            <div className="stories__add-box">
              <button
                className="story story--add"
                type="button"
                disabled={busy}
                onClick={() => targets.length === 1 && pick(targets[0])}
                /* Клубов у руководителя может быть несколько — тогда сначала спросим,
                   от чьего имени история */
                popoverTarget={targets.length > 1 ? 'story-target' : undefined}
              >
                {/* Сначала кнопка, под ней подпись — порядок здесь тот же, что на экране */}
                <span className="story__plus" aria-hidden="true">
                  <IconPlus />
                </span>
                <span className="story__name">{busy ? 'Загружаем…' : 'Добавить'}</span>
              </button>

              {targets.length > 1 && (
                <div className="row-menu stories__menu" id="story-target" popover="auto">
                  {targets.map((item) => (
                    <button
                      key={item.club ?? 'self'}
                      className="row-menu__item"
                      type="button"
                      onClick={() => pick(item)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tellers.map((teller) => (
            <button
              key={teller.key}
              className="story"
              type="button"
              onClick={() => setOpen(teller.items[0])}
            >
              <Cover item={teller.items[0]} />

              <span className="story__avatar">
                {teller.photo ? <img src={teller.photo} alt="" /> : initial(teller.name)}
              </span>

              <span className="story__name">{teller.name}</span>
            </button>
          ))}
        </div>

        {/* Стрелки поверх крайних карточек. Спрятанная — disabled: не ловит ни клик,
            ни Tab, но остаётся в разметке, чтобы уйти так же плавно, как пришла */}
        <button
          className={`stories__nav stories__nav--prev${atStart ? '' : ' stories__nav--shown'}`}
          type="button"
          aria-label="Предыдущие истории"
          disabled={atStart}
          onClick={() => page(-1)}
        >
          <IconChevronLeft />
        </button>
        <button
          className={`stories__nav stories__nav--next${atEnd ? '' : ' stories__nav--shown'}`}
          type="button"
          aria-label="Следующие истории"
          disabled={atEnd}
          onClick={() => page(1)}
        >
          <IconChevronRight />
        </button>
      </div>

      {error && <p className="stories__error">{error}</p>}

      <input
        className="visually-hidden"
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        onChange={send}
      />

      <PhotoViewer photo={open} onClose={() => setOpen(null)} />
    </>
  );
}
