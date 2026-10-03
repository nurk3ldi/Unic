import { IconCamera, IconImages } from '../icons.jsx';
import './Page.css';
import './Create.css';

/**
 * «Создать»: что можно выложить. Пока это только выбор — две кнопки без действия;
 * сама публикация истории живёт в ряду историй на главной, а публикаций ещё нет.
 */
const KINDS = [
  { key: 'story', title: 'История', note: 'Фото или видео на сутки', Icon: IconCamera },
  { key: 'post', title: 'Публикация', note: 'Запись в ленте с текстом и фото', Icon: IconImages },
];

export default function Create() {
  return (
    <main className="page">
      <h1 className="page__title">Создать</h1>

      <div className="create">
        {KINDS.map(({ key, title, note, Icon }) => (
          <button key={key} className="create__kind" type="button">
            <span className="create__icon">
              <Icon aria-hidden="true" />
            </span>
            <span className="create__title">{title}</span>
            <span className="create__note">{note}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
