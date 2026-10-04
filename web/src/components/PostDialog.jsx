import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ago } from '../chat.js';
import { IconClose } from '../icons.jsx';
import { initial } from '../people.js';
import { PostActions, PostGallery, postRatio } from './PostCard.jsx';
import './PostDialog.css';

const COMMENT_LIMIT = 1000; // тот же предел на сервере (routes/posts.js)

/**
 * Публикация в окне — как пост в Instagram: слева снимки, справа автор, подпись
 * и комментарии, внизу лайк, «отправить» и поле комментария.
 *
 * Нативный <dialog>: затемнение, Esc и ловушка фокуса — от платформы; нажатие
 * мимо окна тоже закрывает. Окно одно на всю ленту: публикация приходит пропсом,
 * а пока окно растворяется, держится последняя — иначе оно опустело бы раньше,
 * чем ушло.
 */
export default function PostDialog({ post, teller, onClose, onLike, onCount }) {
  const dialogRef = useRef(null);
  const shown = useRef(null);
  if (post) shown.current = { post, teller };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (post && !dialog.open) dialog.showModal();
    if (!post && dialog.open) dialog.close();
  }, [post]);

  const open = shown.current;

  return (
    <dialog
      className="modal post-dialog"
      ref={dialogRef}
      aria-label="Публикация"
      style={open && { '--ratio': postRatio(open.post.photos) }}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {open && (
        // key: другая публикация — новые комментарии и пустое поле, а не чужие
        <div className="post-dialog__box" key={open.post.id}>
          {open.post.photos.length > 0 && (
            <div className="post-dialog__media">
              <PostGallery photos={open.post.photos} />
            </div>
          )}

          <Thread
            post={open.post}
            teller={open.teller}
            live={Boolean(post)}
            onClose={onClose}
            onLike={onLike}
            onCount={onCount}
          />
        </div>
      )}
    </dialog>
  );
}

/** Правая часть окна: кто, подпись и комментарии, действия, поле ввода. */
function Thread({ post, teller, live, onClose, onLike, onCount }) {
  const listRef = useRef(null);
  const [list, setList] = useState(null); // null — ещё читаем
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .postComments(post.id)
      .then(({ comments }) => {
        if (!alive) return;
        setList(comments);
        onCount(comments.length);
      })
      .catch((failure) => alive && setError(failure.message));
    return () => {
      alive = false;
    };
    // Читаем раз на открытие: onCount — новая функция на каждый рендер ленты,
    // в зависимостях она перечитывала бы комментарии без конца
  }, [post.id]);

  async function add(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { comment } = await api.addPostComment(post.id, body);
      const next = [...(list ?? []), comment];
      setList(next);
      onCount(next.length);
      setText('');
      // Свой комментарий — в конце списка: показываем его, а не оставляем за краем
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
    }
  }

  async function remove(id) {
    setError('');
    try {
      await api.deletePostComment(post.id, id);
      const next = list.filter((comment) => comment.id !== id);
      setList(next);
      onCount(next.length);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <section className="post-dialog__side">
      <header className="post-dialog__head">
        <Face person={teller} />
        <strong className="post-dialog__name">{teller.name}</strong>
        <button
          className="post-dialog__close"
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <IconClose aria-hidden="true" />
        </button>
      </header>

      <ul className="post-dialog__list" ref={listRef}>
        {/* Подпись — первой строкой разговора, как в Instagram */}
        {post.text && (
          <Entry person={teller} text={post.text} createdAt={post.createdAt} />
        )}

        {list?.map((comment) => (
          <Entry
            key={comment.id}
            person={comment.author}
            text={comment.text}
            createdAt={comment.createdAt}
            onDelete={comment.canDelete ? () => remove(comment.id) : undefined}
          />
        ))}

        {list?.length === 0 && <li className="post-dialog__empty">Комментариев пока нет</li>}
        {!list && !error && <li className="post-dialog__empty">Загружаем…</li>}
      </ul>

      <footer className="post-dialog__foot">
        <PostActions post={post} teller={teller} onLike={onLike} />

        {error && (
          <p className="post-dialog__error" role="alert">
            {error}
          </p>
        )}

        <form className="post-dialog__form" onSubmit={add}>
          <label className="visually-hidden" htmlFor="post-comment">
            Комментарий
          </label>
          <input
            id="post-comment"
            className="post-dialog__input"
            value={text}
            maxLength={COMMENT_LIMIT}
            placeholder="Добавьте комментарий…"
            autoComplete="off"
            enterKeyHint="send"
            // Закрывающееся окно поле не трогает — иначе оно перехватило бы фокус
            disabled={!live}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            className="post-dialog__send"
            type="submit"
            disabled={!text.trim() || sending}
          >
            Опубликовать
          </button>
        </form>
      </footer>
    </section>
  );
}

/** Строка разговора: кружок, имя с текстом, под ними — когда и «Удалить». */
function Entry({ person, text, createdAt, onDelete }) {
  return (
    <li className="post-dialog__entry">
      <Face person={person} />
      <div className="post-dialog__body">
        <p className="post-dialog__text">
          <strong>{person.name}</strong>
          {'\u00A0'}
          {text}
        </p>
        <p className="post-dialog__meta">
          <time dateTime={createdAt}>{ago(createdAt)}</time>
          {onDelete && (
            <button className="post-dialog__delete" type="button" onClick={onDelete}>
              Удалить
            </button>
          )}
        </p>
      </div>
    </li>
  );
}

function Face({ person }) {
  return (
    <span className="post__avatar">
      {person.photo ? <img src={person.photo} alt="" /> : initial(person.name)}
    </span>
  );
}
