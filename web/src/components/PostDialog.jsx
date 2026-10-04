import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ago } from '../chat.js';
import { IconClose, IconDots, IconEdit, IconSend, IconTrash } from '../icons.jsx';
import { initial } from '../people.js';
import { PostGallery, postRatio } from './PostCard.jsx';
import './PostDialog.css';

const COMMENT_LIMIT = 1000; // тот же предел на сервере (routes/posts.js)
// Ник в тексте комментария; скобки — чтобы split оставил его отдельным куском
const MENTION = /(?<![a-z0-9_@.])(@[a-z0-9_]+)/gi;

/**
 * Публикация в окне — как пост в Instagram: слева снимки, справа автор, подпись
 * и комментарии, внизу поле комментария. Лайк и «отправить» остаются в карточке
 * ленты — окно только про разговор.
 *
 * Нативный <dialog>: затемнение, Esc и ловушка фокуса — от платформы; нажатие
 * мимо карточки тоже закрывает. Сам <dialog> — прозрачный слой во весь экран:
 * карточка стоит в его центре, а ✕ — в углу экрана, вне карточки. Окно одно на всю ленту: публикация приходит пропсом,
 * а пока окно растворяется, держится последняя — иначе оно опустело бы раньше,
 * чем ушло.
 */
export default function PostDialog({ post, teller, onClose, onCount }) {
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
            onCount={onCount}
          />
        </div>
      )}

      {/* ✕ — вне карточки, в углу экрана, как в окне просмотра снимков */}
      <button className="post-dialog__close" type="button" aria-label="Закрыть" onClick={onClose}>
        <IconClose aria-hidden="true" />
      </button>
    </dialog>
  );
}

/** Правая часть окна: кто, подпись и комментарии, поле ввода. */
function Thread({ post, teller, live, onCount }) {
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const [list, setList] = useState(null); // null — ещё читаем
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef(null);
  // Чей «···» нажат (меню одно на весь список) и какой комментарий сейчас правят
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);

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

  // Поле растёт вместе с текстом: что не влезло в строку, уходит на следующую.
  // Высота ставится до отрисовки — кадра со старой высотой не бывает
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }, [text]);

  /**
   * Enter — отправить, Shift+Enter — новая строка; пока идёт набор через IME, Enter его.
   * Esc во время правки отменяет правку, а не закрывает всё окно.
   */
  function onKey(event) {
    if (event.key === 'Escape' && editingId) {
      event.preventDefault();
      stopEditing();
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form.requestSubmit();
  }

  /**
   * Меню открывает сам браузер (popovertarget), здесь — только чьё оно и где.
   * Лежит в верхнем слое, поэтому прокручиваемый список его не обрезает; у нижнего
   * края экрана встаёт над кнопкой, а не под ней.
   */
  function aim(event, id) {
    const rect = event.currentTarget.getBoundingClientRect();
    const menu = menuRef.current;
    const below = window.innerHeight - rect.bottom > 120;
    menu.style.top = below ? `${rect.bottom + 4}px` : 'auto';
    menu.style.bottom = below ? 'auto' : `${window.innerHeight - rect.top + 4}px`;
    menu.style.left = `${rect.left}px`;
    setMenuId(id);
  }

  /** Правят в том же поле, где пишут: текст комментария встаёт в него целиком. */
  function startEditing(comment) {
    menuRef.current.hidePopover();
    setEditingId(comment.id);
    setText(comment.text);
    setError('');
    inputRef.current?.focus();
  }

  /**
   * «Ответить»: в поле встаёт ник того, кому отвечают, — дальше пишут как обычно.
   * Ответ остаётся обычным комментарием в общем списке: ник в начале и есть связь.
   */
  function replyTo(comment) {
    setEditingId(null);
    setText(`@${comment.author.username} `);
    setError('');
    inputRef.current?.focus();
  }

  function stopEditing() {
    setEditingId(null);
    setText('');
  }

  async function submit(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      if (editingId) {
        const { comment } = await api.editPostComment(post.id, editingId, body);
        setList(list.map((item) => (item.id === comment.id ? comment : item)));
        stopEditing();
      } else {
        const { comment } = await api.addPostComment(post.id, body);
        const next = [...(list ?? []), comment];
        setList(next);
        onCount(next.length);
        setText('');
        // Свой комментарий — в конце списка: показываем его, а не оставляем за краем
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
        });
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
    }
  }

  async function remove(id) {
    menuRef.current.hidePopover();
    if (id === editingId) stopEditing();
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

  const target = list?.find((comment) => comment.id === menuId);

  return (
    <section className="post-dialog__side">
      <header className="post-dialog__head">
        <Face person={teller} />
        <strong className="post-dialog__name">{teller.name}</strong>
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
            edited={comment.edited}
            onReply={comment.author.username ? () => replyTo(comment) : undefined}
            onMenu={
              comment.canEdit || comment.canDelete
                ? (event) => aim(event, comment.id)
                : undefined
            }
          />
        ))}

        {list?.length === 0 && <li className="post-dialog__empty">Комментариев пока нет</li>}
        {!list && !error && <li className="post-dialog__empty">Загружаем…</li>}
      </ul>

      {/* Меню комментария — одно на весь список; что в нём, зависит от того, чей комментарий */}
      <div className="row-menu post-dialog__menu" id="comment-menu" popover="auto" ref={menuRef}>
        {target?.canEdit && (
          <button className="row-menu__item" type="button" onClick={() => startEditing(target)}>
            <IconEdit aria-hidden="true" />
            Редактировать
          </button>
        )}
        {target?.canDelete && (
          <button
            className="row-menu__item row-menu__item--danger"
            type="button"
            onClick={() => remove(target.id)}
          >
            <IconTrash aria-hidden="true" />
            Удалить
          </button>
        )}
      </div>

      <footer className="post-dialog__foot">
        {/* Правка идёт в том же поле — полоска над ним говорит, что это не новый комментарий */}
        {editingId && (
          <p className="post-dialog__editing">
            Редактирование комментария
            <button type="button" onClick={stopEditing}>
              Отмена
            </button>
          </p>
        )}

        {error && (
          <p className="post-dialog__error" role="alert">
            {error}
          </p>
        )}

        <form className="post-dialog__form" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="post-comment">
            Комментарий
          </label>
          <textarea
            id="post-comment"
            className="post-dialog__input"
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={COMMENT_LIMIT}
            placeholder="Добавьте комментарий…"
            enterKeyHint="send"
            // Закрывающееся окно поле не трогает — иначе оно перехватило бы фокус
            disabled={!live}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKey}
          />
          <button
            className="post-dialog__send"
            type="submit"
            aria-label={editingId ? 'Сохранить комментарий' : 'Опубликовать комментарий'}
            disabled={!text.trim() || sending}
          >
            <IconSend aria-hidden="true" />
          </button>
        </form>
      </footer>
    </section>
  );
}

/**
 * Строка разговора: кружок, имя с текстом, под ними — когда, «Ответить» и «···».
 * Человек подписан ником, а не ФИО — как в Instagram; у клуба ника нет, там имя.
 */
function Entry({ person, text, createdAt, edited, onReply, onMenu }) {
  return (
    <li className="post-dialog__entry">
      <Face person={person} />
      <div className="post-dialog__body">
        <p className="post-dialog__text">
          <strong>{person.username ?? person.name}</strong>
          {'\u00A0'}
          {/* Ник в тексте выделен цветом: по нему видно, кому отвечают. Слева от «@»
              не должно быть буквы или точки — почта не ник */}
          {text.split(MENTION).map((part, index) =>
            index % 2 ? (
              <span className="post-dialog__mention" key={index}>
                {part}
              </span>
            ) : (
              part
            ),
          )}
        </p>
        <p className="post-dialog__meta">
          <time dateTime={createdAt}>{ago(createdAt)}</time>
          {edited && <span>изменено</span>}
          {onReply && (
            <button className="post-dialog__reply" type="button" onClick={onReply}>
              Ответить
            </button>
          )}
          {/* «···» проявляется, когда курсор над комментарием: в покое строка чистая */}
          {onMenu && (
            <button
              className="post-dialog__more"
              type="button"
              aria-label="Действия с комментарием"
              popoverTarget="comment-menu"
              onClick={onMenu}
            >
              <IconDots aria-hidden="true" />
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
