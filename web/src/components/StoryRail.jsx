import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { IconChevronLeft, IconChevronRight, IconPlus } from '../icons.jsx';
import { initial } from '../people.js';
import { storyPhoto } from '../photo.js';
import PhotoViewer from './PhotoViewer.jsx';
import './StoryRail.css';

// Сколько карточек видно в ряду разом, считая «Добавить». Число уходит в сетку
// (`--cards`): от него ширина карточки. Остальные — за краем, их листают стрелками.
// Кто выложил раньше, тот и левее
const CARDS = 5;

/** Размеры видео — до отправки: сервер сам их не считает, а лента ставит кадр по ним. */
async function videoMeta(file) {
  if (!file.type.startsWith('video/')) return {};

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const finish = (result, error) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (error) reject(new Error(error));
      else resolve(result);
    };
    const timer = setTimeout(() => finish(null, 'Не удалось прочитать видео'), 10_000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const { videoWidth: width, videoHeight: height, duration } = video;
      if (!width || !height || Math.abs(width / height - 9 / 16) > 0.001) {
        finish(null, 'Для истории выберите видео в формате 9:16');
        return;
      }
      finish({ width, height, duration: Number.isFinite(duration) ? duration : undefined });
    };
    video.onerror = () => finish(null, 'Не удалось открыть видео. Выберите MP4 или WebM.');
    video.src = url;
  });
}

/**
 * Обложка карточки: у видео — первый кадр, его же берёт и лента чата.
 * Кадр лежит в обёртке: на карточке он размыт, и обёртка обрезает
 * размытие по своим углам — иначе оно расплывалось бы за край карточки.
 */
function Cover({ item }) {
  return (
    <span className="story__cover">
      {item.kind === 'video' ? (
        <video src={`${item.url}#t=0.1`} muted playsInline />
      ) : (
        <img src={item.url} alt="" />
      )}
    </span>
  );
}

/** Есть ли у рассказчика история, которую этот человек ещё не открывал. */
const isNew = (teller) => teller.items.some((item) => !item.seen);

/**
 * Истории: ряд карточек над лентой. Публикуют только клуб (его руководитель) и
 * университет — у остальных карточки «Добавить» просто нет. История живёт сутки.
 *
 * Карточка — один рассказчик (клуб или университет), за ней до 10 историй за сутки.
 * Открытая карточка листается как в Instagram: полоски сверху, ‹ ›, снимок уходит
 * сам через 5 секунд, видео — когда доиграло; после последней истории — следующий
 * рассказчик. Свои истории живут в карточке «Добавить»: нажал на карточку — смотришь,
 * на плюс — выкладываешь ещё.
 */
export default function StoryRail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const followedLink = useRef(null);
  const [tellers, setTellers] = useState([]);
  const [targets, setTargets] = useState([]);
  // Что открыто: индексы рассказчика в `order` и истории у него
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
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
        setLoaded(true);
      })
      .catch(() => {
        // Молча: ряд историй — не место для ошибок сети
      });
  }, []);

  useEffect(load, [load]);

  // Свои истории — в карточке «Добавить», в ряду второй раз не повторяются.
  // В просмотре они идут первыми, как и на экране
  const mine = tellers.find((teller) => targets.some((target) => target.key === teller.key));
  const order = useMemo(
    () => [...tellers].sort((a, b) => (b === mine) - (a === mine)),
    [tellers, mine],
  );

  const current = open && order[open.teller];
  const shown = current?.items[open.item] ?? null;

  useEffect(() => {
    const id = searchParams.get('story');
    if (!id || !loaded || followedLink.current === id) return;
    followedLink.current = id;
    const teller = order.findIndex((entry) => entry.items.some((item) => item.id === id));
    if (teller >= 0) setOpen({ teller, item: order[teller].items.findIndex((item) => item.id === id) });
    else setError('История недоступна: она удалена или прошло 24 часа');
  }, [searchParams, order, loaded]);

  function close() {
    setOpen(null);
    if (searchParams.has('story')) {
      const params = new URLSearchParams(searchParams);
      params.delete('story');
      setSearchParams(params, { replace: true });
    }
  }

  async function removeStory(id) {
    await api.deleteStory(id);
    close();
    load();
  }

  // Лайк и «просмотрено» меняют одну историю на месте — без перезагрузки ряда
  function patchItem(id, patch) {
    setTellers((entries) => entries.map((entry) => ({
      ...entry,
      items: entry.items.map((item) => item.id === id ? { ...item, ...patch } : item),
    })));
  }

  // Открытая история — просмотренная. Отметка сразу и здесь: обводка карточки
  // гаснет, как только у рассказчика не осталось несмотренного
  useEffect(() => {
    if (!shown || shown.seen) return;
    patchItem(shown.id, { seen: true });
    api.viewStory(shown.id).catch(() => {});
  }, [shown]);

  // Шаги серии для окна: вперёд — следующая история, потом следующий рассказчик,
  // за последним — выход. Назад — так же, до самой первой
  const steps = useMemo(() => {
    if (!open || !current) return undefined;
    const { teller, item } = open;
    return {
      index: item,
      count: current.items.length,
      onNext: () =>
        setOpen(
          item + 1 < current.items.length
            ? { teller, item: item + 1 }
            : teller + 1 < order.length
              ? { teller: teller + 1, item: 0 }
              : null,
        ),
      onPrev:
        item > 0
          ? () => setOpen({ teller, item: item - 1 })
          : teller > 0
            ? () =>
                setOpen({
                  teller: teller - 1,
                  item: order[teller - 1].items.length - 1,
                })
            : null,
    };
  }, [open, current, order]);

  function watch(teller) {
    setOpen({ teller: order.indexOf(teller), item: 0 });
  }

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
    // Лимит известен заранее — не гоняем файл на сервер ради отказа
    if (chosen.left <= 0) {
      setError('На сегодня лимит исчерпан: не больше 10 историй в сутки');
      return;
    }
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
      const image = file.type.startsWith('image/');
      if (file.size > (image ? 25 : 100) * 1024 * 1024) {
        throw new Error(image ? 'Фото больше 25 МБ' : 'Видео больше 100 МБ');
      }
      const prepared = image ? await storyPhoto(file) : { file, ...await videoMeta(file) };
      await api.uploadStory(prepared.file, target.current?.club ?? null, prepared);
      load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  // Ни историй, ни права публиковать — ряда нет совсем
  if (!tellers.length && !targets.length) {
    return error ? <p className="stories__error" role="alert">{error}</p> : null;
  }

  const canAdd = targets.length > 0;

  // Клубов у руководителя может быть несколько — тогда сначала спросим, от чьего имени
  const addProps = {
    disabled: busy,
    onClick: () => targets.length === 1 && pick(targets[0]),
    popoverTarget: targets.length > 1 ? 'story-target' : undefined,
  };

  return (
    <>
      <div className="stories-box">
        <div className="stories" ref={railRef} onScroll={measure} style={{ '--cards': CARDS }}>
          {canAdd && (
            <div className="stories__add-box">
              <div
                className={`story story--add${mine ? ' story--mine' : ''}${mine && isNew(mine) ? ' story--new' : ''}${busy ? ' story--busy' : ''}`}
              >
                {mine && <Cover item={mine.items.at(-1)} />}

                {/* Своих историй нет — вся карточка добавляет. Есть — карточка
                    открывает их, а добавляет только плюс */}
                <button
                  className="story__hit"
                  type="button"
                  aria-label={mine ? 'Смотреть свои истории' : 'Добавить историю'}
                  {...(mine ? { onClick: () => watch(mine) } : addProps)}
                />

                {mine ? (
                  <button
                    className="story__plus"
                    type="button"
                    aria-label="Добавить историю"
                    {...addProps}
                  >
                    <IconPlus />
                  </button>
                ) : (
                  <span className="story__plus" aria-hidden="true">
                    <IconPlus />
                  </span>
                )}
                <span className="story__name">{busy ? 'Загружаем…' : 'Добавить'}</span>
              </div>

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

          {tellers
            .filter((teller) => teller !== mine)
            .map((teller) => (
              <button
                key={teller.key}
                className={`story${isNew(teller) ? ' story--new' : ''}`}
                type="button"
                onClick={() => watch(teller)}
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

      <PhotoViewer
        photo={shown}
        tellers={open && { list: order, index: open.teller, onPick: (teller) => setOpen({ teller, item: 0 }) }}
        steps={steps}
        onClose={close}
        onDelete={removeStory}
        onLike={(id, liked) => patchItem(id, { liked })}
      />
    </>
  );
}
