import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { POLL_MS } from '../chat.js';
import { shortName } from '../people.js';
import './ClubChatCard.css';

/** Сколько строк влезает в квадрат карточки, не превращая её в ленту */
const PREVIEW = 4;

/**
 * Свёрнутый вид чата в карточке клуба: последние строки, самая свежая внизу.
 *
 * Читать — можно, писать — нет: поле ввода в квадрате 340px было бы тесным,
 * а карточка целиком ведёт в чат, где для этого есть место.
 */
export default function ClubChatCard({ clubId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      if (document.hidden) return;
      try {
        const { messages } = await api.clubMessages(clubId);
        if (alive) {
          setMessages(messages.slice(-PREVIEW));
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

  if (loading) return <p className="chat-preview__empty">Загружаем…</p>;
  if (error) return <p className="chat-preview__empty">{error}</p>;
  if (messages.length === 0) {
    return <p className="chat-preview__empty">Сообщений пока нет</p>;
  }

  return (
    <ul className="chat-preview">
      {messages.map((message) => (
        <li className="chat-preview__row" key={message.id}>
          <span className="chat-preview__author">{shortName(message.author)}</span>
          <span className="chat-preview__text">{message.text}</span>
        </li>
      ))}
    </ul>
  );
}
