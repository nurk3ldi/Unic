import { Link } from 'react-router-dom';
import { IconCamera, IconImages } from '../icons.jsx';
import './Page.css';
import './Create.css';

/**
 * «Создать»: что можно выложить. «Публикация» ведёт на свою страницу; «История»
 * пока без действия — истории выкладывают из их ряда на главной.
 */
export default function Create() {
  return (
    <main className="page">
      <h1 className="page__title">Создать</h1>

      <div className="create">
        <button className="create__kind" type="button">
          <span className="create__icon">
            <IconCamera aria-hidden="true" />
          </span>
          <span className="create__title">История</span>
          <span className="create__note">Фото или видео на сутки</span>
        </button>

        <Link className="create__kind" to="/create/post" viewTransition>
          <span className="create__icon">
            <IconImages aria-hidden="true" />
          </span>
          <span className="create__title">Публикация</span>
          <span className="create__note">Запись в ленте с текстом и фото</span>
        </Link>
      </div>
    </main>
  );
}
