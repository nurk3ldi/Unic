import { useEffect, useState } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { POLL_MS } from '../chat.js';
import { authorColor, shortName } from '../people.js';
import './ClubChatCard.css';

// Сколько последних реплик держим: в квадрат карточки больше не помещается,
// а лишние всё равно скрылись бы под верхним краем
const SHOWN = 12;

/**
 * Свёрнутый чат: живая переписка в миниатюре — те же пузыри, что в самом чате
 * (своё справа синим, чужое слева с именем), на тех же обоях. Новое приходит
 * тем же опросом, что и в чате, поэтому видно, как пишут прямо сейчас.
 *
 * Писать отсюда нельзя: поле ввода в квадрате было бы тесным, а карточка
 * целиком ведёт в чат, где для этого есть место.
 */
export default function ClubChatCard({ clubId }) {
  const { user } = useAuth();
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
          setMessages(messages.slice(-SHOWN));
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

  return (
    <div className="chat-card">
      {messages.length === 0 ? (
        <p className="chat-card__empty">Сообщений пока нет</p>
      ) : (
        /* Лента прижата к низу, как в чате: новое — последней строкой, старое
           уходит вверх и растворяется под краем */
        <div className="chat-card__feed">
          {messages.map((message) => {
            const own = message.authorId === user?.id;
            return (
              <div
                className={`chat-card__msg${own ? ' chat-card__msg--own' : ''}`}
                key={message.id}
              >
                {!own && (
                  <span
                    className="chat-card__author"
                    style={{ color: authorColor(message.authorId) }}
                  >
                    {shortName(message.author)}
                  </span>
                )}
                <span className="chat-card__text">{message.text || 'Фото'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Карточка и так ссылка, но строка снизу называет, куда именно */}
      <span className="chat-card__more">
        Открыть чат
        <IoChevronForward aria-hidden="true" />
      </span>
    </div>
  );
}
