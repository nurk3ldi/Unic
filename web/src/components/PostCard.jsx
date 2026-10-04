import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ago } from '../chat.js';
import {
  IconChevronLeft,
  IconChevronRight,
  IconComment,
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
 * по одному, ниже — лайк и комментарии слева, «отправить» справа, затем подпись:
 * имя и текст одной строкой, длинный свёрнут до двух строк. Комментарии
 * раскрываются под подписью по нажатию на их значок.
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
  const [talk, setTalk] = useState(false); // комментарии раскрыты
  const [count, setCount] = useState(post.comments);

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

        <button
          className="post__action"
          type="button"
          aria-label="Комментарии"
          aria-expanded={talk}
          onClick={() => setTalk((was) => !was)}
        >
          <IconComment aria-hidden="true" />
          {count > 0 && <span className="post__count">{count}</span>}
        </button>

        <button
          className="post__action post__action--end"
          type="button"
          aria-label="Отправить"
          onClick={send}
        >
          {copied && <span className="post__copied">Ссылка скопирована</span>}
          <IconSend aria-hidden="true" />
        </button>
      </div>

      {text && (
        <p className={`post__text${open ? '' : ' post__text--clamp'}`} ref={textRef}>
          {/* Между именем и текстом — неразрывный пробел: иначе длинное слово без
              пробелов целиком уходило бы на следующую строку, оставляя имя одно */}
          <strong>{teller.name}</strong>
          {'\u00A0'}
          {text}
        </p>
      )}
      {long && !open && (
        <button className="post__expand" type="button" onClick={() => setOpen(true)}>
          ещё
        </button>
      )}

      {talk && <Comments postId={post.id} onCount={setCount} />}
    </article>
  );
}

const COMMENT_LIMIT = 1000; // тот же предел на сервере (routes/posts.js)

/**
 * Комментарии под публикацией: список в порядке разговора и поле снизу.
 * Читаются, когда их раскрыли, — лента не тянет чужие обсуждения заранее.
 */
function Comments({ postId, onCount }) {
  const [list, setList] = useState(null); // null — ещё читаем
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .postComments(postId)
      .then(({ comments }) => {
        if (!alive) return;
        setList(comments);
        onCount(comments.length);
      })
      .catch((failure) => alive && setError(failure.message));
    return () => {
      alive = false;
    };
  }, [postId, onCount]);

  async function add(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { comment } = await api.addPostComment(postId, body);
      setList((was) => [...(was ?? []), comment]);
      onCount((was) => was + 1);
      setText('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
    }
  }

  async function remove(id) {
    setError('');
    try {
      await api.deletePostComment(postId, id);
      setList((was) => was.filter((comment) => comment.id !== id));
      onCount((was) => was - 1);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <section className="comments" aria-label="Комментарии">
      {list?.length > 0 && (
        <ul className="comments__list">
          {list.map((comment) => (
            <li className="comment" key={comment.id}>
              <span className="post__avatar comment__avatar">
                {comment.author.photo ? (
                  <img src={comment.author.photo} alt="" />
                ) : (
                  initial(comment.author.name)
                )}
              </span>

              <div className="comment__body">
                <p className="comment__text">
                  <strong>{comment.author.name}</strong>
                  {'\u00A0'}
                  {comment.text}
                </p>
                <p className="comment__meta">
                  <time dateTime={comment.createdAt}>{ago(comment.createdAt)}</time>
                  {comment.canDelete && (
                    <button
                      className="comment__delete"
                      type="button"
                      onClick={() => remove(comment.id)}
                    >
                      Удалить
                    </button>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list?.length === 0 && <p className="comments__empty">Комментариев пока нет</p>}
      {!list && !error && <p className="comments__empty">Загружаем…</p>}

      {error && (
        <p className="comments__error" role="alert">
          {error}
        </p>
      )}

      <form className="comments__form" onSubmit={add}>
        <label className="visually-hidden" htmlFor={`comment-${postId}`}>
          Комментарий
        </label>
        <input
          id={`comment-${postId}`}
          className="comments__input"
          value={text}
          maxLength={COMMENT_LIMIT}
          placeholder="Добавьте комментарий…"
          autoComplete="off"
          enterKeyHint="send"
          autoFocus
          onChange={(event) => setText(event.target.value)}
        />
        {text.trim() && (
          <button className="comments__send" type="submit" disabled={sending}>
            Опубликовать
          </button>
        )}
      </form>
    </section>
  );
}
