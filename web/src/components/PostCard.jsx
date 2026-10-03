import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ago } from '../chat.js';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconHeart,
  IconSend,
  IconTrash,
} from '../icons.jsx';
import { initial } from '../people.js';
import './PostCard.css';

// Кадр берёт пропорцию первого снимка, но не уже 4:5 и не шире 1,91:1 — как в Instagram
const RATIO_MIN = 0.8;
const RATIO_MAX = 1.91;

/**
 * Публикация в ленте — по образцу Instagram: строка «кто · когда», под ней снимки
 * по одному, ниже — лайк слева и «отправить» справа, в самом низу подпись: имя
 * и текст одной строкой, длинный свёрнут до двух строк.
 *
 * Снимки — лента с прилипанием (`scroll-snap`): листают стрелками, пальцем или
 * тачпадом, точки под кадром показывают, который сейчас. Нажатие на снимок
 * открывает его в окне на весь экран.
 */
export default function PostCard({ post, teller, onOpen, onDelete, onLike }) {
  const { text, photos } = post;
  const trackRef = useRef(null);
  const menuRef = useRef(null);
  const textRef = useRef(null);
  const [at, setAt] = useState(0);
  const [menu, setMenu] = useState(false);
  const [long, setLong] = useState(false); // подпись не влезла в две строки
  const [open, setOpen] = useState(false); // «ещё» нажато — подпись целиком
  const [copied, setCopied] = useState(false);

  // Влезла ли подпись, знает только раскладка: сравниваем высоту текста и коробки
  useLayoutEffect(() => {
    const node = textRef.current;
    if (node) setLong(node.scrollHeight > node.clientHeight + 1);
  }, [text]);

  /**
   * «Отправить»: ссылка на публикацию — системным окном «Поделиться», а где его
   * нет, в буфер обмена. По ссылке главная открывается на этой публикации.
   */
  async function send() {
    const url = new URL(`/?post=${post.id}`, location.origin).href;
    try {
      if (navigator.share) return await navigator.share({ title: teller.name, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Окно «Поделиться» закрыли или буфер недоступен — ничего не случилось
    }
  }

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
    <article className="post" id={`post-${post.id}`}>
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

      {/* Лайк и «отправить» — по краям строки. Число рядом с сердцем — когда есть что считать */}
      <div className="post__actions">
        <button
          className={`post__action${post.liked ? ' post__action--liked' : ''}`}
          type="button"
          aria-label={post.liked ? 'Убрать лайк' : 'Нравится'}
          aria-pressed={post.liked}
          onClick={onLike}
        >
          <IconHeart aria-hidden="true" />
          {post.likes > 0 && <span className="post__count">{post.likes}</span>}
        </button>

        <button className="post__action" type="button" aria-label="Отправить" onClick={send}>
          {copied && <span className="post__copied">Ссылка скопирована</span>}
          <IconSend aria-hidden="true" />
        </button>
      </div>

      {text && (
        <p className={`post__text${open ? '' : ' post__text--clamp'}`} ref={textRef}>
          {/* Между именем и текстом — неразрывный пробел: иначе длинное слово без
              пробелов целиком уходило бы на следующую строку, оставляя имя одно */}
          <strong>{teller.name}</strong>
          {' '}
          {text}
        </p>
      )}
      {long && !open && (
        <button className="post__expand" type="button" onClick={() => setOpen(true)}>
          ещё
        </button>
      )}
    </article>
  );
}
