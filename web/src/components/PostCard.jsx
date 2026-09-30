import { IconDots } from '../icons.jsx';
import { initial } from '../people.js';
import './PostCard.css';

/**
 * Публикация клуба в ленте: кто и когда, текст, снимки.
 *
 * Пока только вид — публикаций в базе ещё нет, поэтому данные приходят готовыми,
 * а время — уже строкой. Раскладка снимков зависит от их числа: один — во всю
 * ширину, два — рядом, три — большой слева и два друг над другом справа.
 */
export default function PostCard({ post }) {
  const { author, time, text, photos = [] } = post;

  return (
    <article className="post">
      <header className="post__head">
        <span className="post__avatar">
          {author.photo ? <img src={author.photo} alt="" /> : initial(author.name)}
        </span>

        <div className="post__who">
          <span className="post__name">{author.name}</span>
          <span className="post__time">{time}</span>
        </div>

        <button className="post__more" type="button" aria-label="Действия с публикацией">
          <IconDots />
        </button>
      </header>

      {text && <p className="post__text">{text}</p>}

      {photos.length > 0 && (
        <div className="post__photos" data-count={Math.min(photos.length, 3)}>
          {photos.slice(0, 3).map((src) => (
            <img key={src} className="post__photo" src={src} alt="" />
          ))}
        </div>
      )}
    </article>
  );
}
