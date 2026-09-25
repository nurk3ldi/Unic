import { useEffect, useState } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { api } from '../api.js';
import { POLL_MS, messageTime } from '../chat.js';
import { authorColor, initial, shortName } from '../people.js';
import './ClubChatCard.css';

/**
 * Свёрнутый вид чата: **одна последняя реплика**, как в виджете сообщений.
 *
 * Раньше здесь лежали четыре строки подряд, прижатые к низу: половина карточки
 * пустовала, а три одинаковые серые строки ничего не выделяли. Одна реплика
 * крупно отвечает на вопрос «что там нового» и заполняет квадрат сама.
 *
 * Писать отсюда нельзя: поле ввода в квадрате 340px было бы тесным,
 * а карточка целиком ведёт в чат, где для этого есть место.
 */
export default function ClubChatCard({ clubId }) {
  const [last, setLast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      if (document.hidden) return;
      try {
        const { messages } = await api.clubMessages(clubId);
        if (alive) {
          setLast(messages.at(-1) ?? null);
          setError('');
        }
      } catch (failure) {
        if (alive) setError(failure.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [clubId]);

  if (loading) return <p className="chat-card__empty">Загружаем…</p>;
  if (error) return <p className="chat-card__empty">{error}</p>;
  if (!last) return <p className="chat-card__empty">Сообщений пока нет</p>;

  return (
    <div className="chat-card">
      <div className="chat-card__head">
        <span className="chat-card__avatar" aria-hidden="true">
          {initial(last.author)}
        </span>
        <span className="chat-card__author" style={{ color: authorColor(last.authorId) }}>
          {shortName(last.author)}
        </span>
      </div>

      <p className="chat-card__text">{last.text}</p>

      <time className="chat-card__time" dateTime={last.createdAt}>
        {messageTime.format(new Date(last.createdAt))}
      </time>

      {/* Карточка и так ссылка, но строка снизу называет, куда именно */}
      <span className="chat-card__more">
        Открыть чат
        <IoChevronForward aria-hidden="true" />
      </span>
    </div>
  );
}
