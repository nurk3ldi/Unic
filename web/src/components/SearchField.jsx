import { IoCloseOutline, IoSearchOutline } from 'react-icons/io5';
import './SearchField.css';

/**
 * Поле поиска: заполненная капсула, как в списках Apple — поле видно и без рамки.
 * Подпись живёт внутри (placeholder), для скринридера дублируется в aria-label.
 *
 * Крестик свой, а не браузерный: Chrome рисует в `input[type=search]` жирный
 * синий глиф, который спорит с акцентом и не подчиняется стилям. Наш появляется
 * только когда есть что стирать, и возвращает фокус в поле — стирают, чтобы
 * набрать другое.
 */
export default function SearchField({ label, value, onChange, onClear }) {
  return (
    <div className="search">
      <span className="search__field">
        <IoSearchOutline aria-hidden="true" />
        <input
          className="search__input"
          type="search"
          placeholder={label}
          aria-label={label}
          value={value}
          onChange={onChange}
        />

        {value && onClear && (
          <button className="search__clear" type="button" aria-label="Очистить" onClick={onClear}>
            <IoCloseOutline aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  );
}
