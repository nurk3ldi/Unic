import './AsideHead.css';

/**
 * Заголовок раздела правой колонки: слово слева, число у правого края.
 *
 * `accent` — когда число зовёт к действию (приглашения ждут ответа). Без него
 * оно просто говорит, сколько всего, и остаётся тихим, серым.
 */
export default function AsideHead({ title, value, accent = false }) {
  return (
    <section className="aside-head">
      <h2 className="aside-head__title">{title}</h2>

      <span className={`aside-head__count${accent ? ' aside-head__count--accent' : ''}`}>
        {value}
      </span>
    </section>
  );
}
