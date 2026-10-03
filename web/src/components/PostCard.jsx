import { useEffect, useRef, useState } from 'react';
import { ago } from '../chat.js';
import { IconChevronLeft, IconChevronRight, IconDots, IconTrash } from '../icons.jsx';
import { initial } from '../people.js';
import './PostCard.css';

// Кадр берёт пропорцию первого снимка, но не уже 4:5 и не шире 1,91:1 — как в Instagram
const RATIO_MIN = 0.8;
const RATIO_MAX = 1.91;

/**
 * Публикация в ленте — по образцу Instagram: строка «кто · когда», под ней снимки
 * по одному, текст — внизу.
 *
 * Снимки — лента с прилипанием (`scroll-snap`): листают стрелками, пальцем или
 * тачпадом, точки под кадром показывают, который сейчас. Нажатие на снимок
 * открывает его в окне на весь экран.
 */
export default function PostCard({ post, teller, onOpen, onDelete }) {
  const { text, photos } = post;
  const trackRef = useRef(null);
  const menuRef = useRef(null);
  const [at, setAt] = useState(0);
  const [menu, setMenu] = useState(false);

  // Меню закрывает нажатие мимо него и Esc — как остальные меню проекта
  useEffect(() => {
    if (!menu) return undefined;
    const outside = (event) => !menuRef.current?.contains(event.target) && setMenu(false);
    const escape = (event) => event.key === 'Escape' && setMenu(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);

  /** Листает на один снимок; при «Уменьшить движение» — сразу, без проезда. */
  function turn(by) {
    const track = trackRef.current;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({ left: by * track.clientWidth, behavior: still ? 'auto' : 'smooth' });
  }

  const ratio = photos.length
    ? Math.min(RATIO_MAX, Math.max(RATIO_MIN, photos[0].width / photos[0].height))
    : 1;

  return (
    <article className="post">
      <header className="post__head">
        <span className="post__avatar">
          {teller.photo ? <img src={teller.photo} alt="" /> : initial(teller.name)}
        </span>

        {/* Имя и время — одной строкой, через точку */}
        <span className="post__name">{teller.name}</span>
        <time className="post__time" dateTime={post.createdAt}>
          {ago(post.createdAt)}
        </time>

        {/* Действие с публикацией пока одно — убрать её; кому нельзя, тому и кнопки нет */}
        {post.canDelete && (
          <div className="post__menu-box" ref={menuRef}>
            <button
              className="post__more"
              type="button"
              aria-label="Действия с публикацией"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((was) => !was)}
            >
              <IconDots />
            </button>

            {menu && (
              <div className="row-menu post__menu" role="menu">
                <button
                  className="row-menu__item row-menu__item--danger"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    if (window.confirm('Удалить публикацию?')) onDelete();
                  }}
                >
                  <IconTrash aria-hidden="true" />
                  Удалить
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {photos.length > 0 && (
        <div className="post__gallery" style={{ '--ratio': ratio }}>
          <div
            className="post__track"
            ref={trackRef}
            onScroll={(event) =>
              setAt(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))
            }
          >
            {photos.map((photo, index) => (
              <button
                key={photo.url}
                className="post__photo"
                type="button"
                aria-label={`Открыть фото ${index + 1} из ${photos.length}`}
                onClick={() => onOpen(index)}
              >
                <img src={photo.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>

          {/* Крайняя стрелка не пропадает из разметки, а гаснет — уходит так же плавно */}
          {photos.length > 1 && (
            <>
              <button
                className="post__turn post__turn--prev"
                type="button"
                aria-label="Предыдущее фото"
                disabled={at === 0}
                onClick={() => turn(-1)}
              >
                <IconChevronLeft aria-hidden="true" />
              </button>
              <button
                className="post__turn post__turn--next"
                type="button"
                aria-label="Следующее фото"
                disabled={at === photos.length - 1}
                onClick={() => turn(1)}
              >
                <IconChevronRight aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}

      {photos.length > 1 && (
        <div className="post__dots" aria-label={`Фото ${at + 1} из ${photos.length}`}>
          {photos.map((photo, index) => (
            <span
              key={photo.url}
              className={`post__dot${index === at ? ' post__dot--on' : ''}`}
            />
          ))}
        </div>
      )}

      {text && <p className="post__text">{text}</p>}
    </article>
  );
}
