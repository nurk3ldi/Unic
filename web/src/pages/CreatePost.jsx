import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { IconChevronLeft, IconClose, IconPlus } from '../icons.jsx';
import { chatPhoto } from '../photo.js';
import './Page.css';
import './CreatePost.css';

// Те же пределы проверяет сервер (routes/posts.js)
const PHOTOS_LIMIT = 10;
const TEXT_LIMIT = 2000;

/**
 * Новая публикация: до десяти снимков и общий текст к ним. Публикуют клуб (его
 * руководитель) и университет — остальным страница это и говорит.
 *
 * Снимки сжимает браузер, как фото в чате, и они уходят вместе с текстом одним
 * запросом: публикации без части своих снимков не бывает.
 */
export default function CreatePost() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [targets, setTargets] = useState(null); // null — ещё не знаем, от чьего имени
  const [target, setTarget] = useState('');
  const [photos, setPhotos] = useState([]); // { id, dataUrl, width, height }
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .postTargets()
      .then(({ targets }) => {
        if (!alive) return;
        setTargets(targets);
        setTarget(targets[0]?.key ?? '');
      })
      .catch((failure) => alive && setError(failure.message));
    return () => {
      alive = false;
    };
  }, []);

  async function addPhotos(event) {
    const files = [...event.target.files];
    event.target.value = ''; // те же файлы можно выбрать снова
    const room = PHOTOS_LIMIT - photos.length;
    setError(files.length > room ? `В публикации не больше ${PHOTOS_LIMIT} фото` : '');

    setReading(true);
    // По одному: десять больших снимков разом заняли бы память ради секунды выигрыша
    for (const file of files.slice(0, room)) {
      try {
        const photo = await chatPhoto(file);
        setPhotos((list) => [...list, { id: crypto.randomUUID(), ...photo }]);
      } catch {
        setError(`Не удалось открыть «${file.name}» — выберите JPEG или PNG`);
      }
    }
    setReading(false);
  }

  async function publish(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.createPost({
        club: targets.find((item) => item.key === target)?.club ?? null,
        text,
        photos: photos.map(({ dataUrl, width, height }) => ({ photo: dataUrl, width, height })),
      });
      navigate('/', { viewTransition: true });
    } catch (failure) {
      setError(failure.message);
      setSending(false);
    }
  }

  const empty = !text.trim() && !photos.length;

  return (
    <main className="page">
      <Link className="page__back" to="/create" viewTransition>
        <IconChevronLeft aria-hidden="true" />
        Создать
      </Link>

      <form className="new-post" onSubmit={publish}>
        <h1 className="page__title">Новая публикация</h1>

        {targets?.length === 0 ? (
          <p className="new-post__note">
            Публиковать могут клуб и университет. Станьте руководителем клуба — и здесь появится
            форма.
          </p>
        ) : (
          <>
            {/* От чьего имени: один клуб — просто строка, несколько — выбор */}
            {targets && (
              <p className="new-post__from">
                От имени{' '}
                {targets.length > 1 ? (
                  <select
                    className="new-post__target"
                    aria-label="От чьего имени"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  >
                    {targets.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong>{targets[0].name}</strong>
                )}
              </p>
            )}

            <div className="new-post__head">
              <span className="new-post__label">Фото</span>
              <span className="new-post__count">
                {photos.length} из {PHOTOS_LIMIT}
              </span>
            </div>

            <ul className="new-post__photos">
              {photos.map((photo, index) => (
                <li className="new-post__photo" key={photo.id}>
                  <img src={photo.dataUrl} alt={`Фото ${index + 1}`} />
                  <button
                    className="new-post__remove"
                    type="button"
                    aria-label={`Убрать фото ${index + 1}`}
                    onClick={() => setPhotos((list) => list.filter((item) => item.id !== photo.id))}
                  >
                    <IconClose aria-hidden="true" />
                  </button>
                </li>
              ))}

              {/* Плитка «добавить» стоит следом за снимками и пропадает на десятом */}
              {photos.length < PHOTOS_LIMIT && (
                <li>
                  <button
                    className="new-post__add"
                    type="button"
                    disabled={reading}
                    onClick={() => fileRef.current.click()}
                  >
                    <IconPlus aria-hidden="true" />
                    {reading ? 'Открываем…' : 'Добавить'}
                  </button>
                </li>
              )}
            </ul>

            <input
              className="visually-hidden"
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              tabIndex={-1}
              onChange={addPhotos}
            />

            <label className="visually-hidden" htmlFor="new-post-text">
              Текст публикации
            </label>
            <textarea
              id="new-post-text"
              className="new-post__text"
              rows={6}
              maxLength={TEXT_LIMIT}
              placeholder="Текст публикации"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <span className="new-post__count new-post__count--text">
              {text.length} из {TEXT_LIMIT}
            </span>

            {error && (
              <p className="new-post__error" role="alert">
                {error}
              </p>
            )}

            <button
              className="new-post__submit"
              type="submit"
              disabled={empty || reading || sending || !targets}
            >
              {sending ? 'Публикуем…' : 'Опубликовать'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
