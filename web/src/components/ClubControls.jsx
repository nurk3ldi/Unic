import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { STATUS_LABELS } from '../club.js';
import './ClubControls.css';

/**
 * Управление самим клубом: состояние и удаление.
 *
 * Строки собраны в группы, как в «Настройках» Apple: значение и действие над
 * ним стоят в одной группе — рядом с тем, на что они влияют, — а необратимое
 * вынесено в свою, отделённую воздухом. Заголовок группе не нужен: шапка
 * карточки уже сказала, чем это управляет.
 *
 * Состояние — одно переключение, а не список из трёх вариантов: работающий
 * клуб приостанавливают, приостановленный возвращают. Что происходит сейчас,
 * видно строкой выше, поэтому кнопка называет действие, а не состояние.
 *
 * Оба действия, которые что-то отнимают — остановка и удаление — спрашивают
 * подтверждение в нативном alert. Возобновление не спрашивает: оно ничего
 * не теряет, а вопрос без повода учит жать «да» не читая.
 */
export default function ClubControls({ club, canManage, onUpdated }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(null); // null | 'pause' | 'delete'

  const paused = club.status !== 'active';

  // Открываем средствами самого элемента: затемнение, Esc и ловушка фокуса — от платформы
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (asking && !dialog.open) {
      dialog.showModal();
      // По умолчанию подсвечен отказ: так промах не стоит клуба
      dialog.querySelector('.alert__button--cancel')?.focus();
    }
    if (!asking && dialog.open) dialog.close();
  }, [asking]);

  async function setStatus(next) {
    setBusy(true);
    setError('');
    try {
      const { club: saved } = await api.updateClub(club.id, { status: next });
      onUpdated(saved);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setAsking(null);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api.deleteClub(club.id);
      navigate('/clubs', { viewTransition: true });
    } catch (failure) {
      setAsking(null);
      setError(failure.message);
      setBusy(false);
    }
  }

  // Останавливать спрашиваем, возобновлять — нет: вопрос уместен там,
  // где действие что-то отнимает
  const ask =
    asking === 'delete'
      ? {
          title: 'Удалить клуб?',
          text: `«${club.name}», его состав и заявки будут удалены безвозвратно.`,
          confirm: busy ? 'Удаляем…' : 'Удалить',
          danger: true,
          run: remove,
        }
      : {
          title: 'Приостановить клуб?',
          text: 'Клуб перестанет быть активным. Вернуть его в работу можно в любой момент.',
          confirm: busy ? 'Останавливаем…' : 'Приостановить',
          danger: false,
          run: () => setStatus('suspended'),
        };

  return (
    <div className="controls">
      <div className="group">
        <div className="group__row">
          <span className="group__label">Состояние</span>
          <span className={`group__value group__value--${club.status}`}>
            <span className="group__dot" aria-hidden="true" />
            {STATUS_LABELS[club.status] ?? club.status}
          </span>
        </div>

        {canManage && (
          <button
            className="group__row group__row--action"
            type="button"
            disabled={busy}
            onClick={() => (paused ? setStatus('active') : setAsking('pause'))}
          >
            {paused ? 'Возобновить работу' : 'Приостановить клуб'}
          </button>
        )}
      </div>

      {canManage && (
        <div className="group group--apart">
          <button
            className="group__row group__row--danger"
            type="button"
            disabled={busy}
            onClick={() => setAsking('delete')}
          >
            Удалить клуб
          </button>
        </div>
      )}

      {error && (
        <p className="controls__error" role="alert">
          {error}
        </p>
      )}

      <dialog className="alert" ref={dialogRef} onClose={() => setAsking(null)}>
        <div className="alert__body">
          <h2 className="alert__title">{ask.title}</h2>
          <p className="alert__text">{ask.text}</p>
        </div>

        <div className="alert__actions">
          <button
            className="alert__button alert__button--cancel"
            type="button"
            disabled={busy}
            onClick={() => setAsking(null)}
          >
            Отмена
          </button>
          <button
            className={`alert__button${ask.danger ? ' alert__button--danger' : ''}`}
            type="button"
            disabled={busy}
            onClick={ask.run}
          >
            {ask.confirm}
          </button>
        </div>
      </dialog>
    </div>
  );
}
