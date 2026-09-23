import { IoSearchOutline } from 'react-icons/io5';
import './SearchField.css';

/**
 * Поле поиска: заполненная капсула, как в списках Apple — поле видно и без рамки.
 * Подпись живёт внутри (placeholder), для скринридера дублируется в aria-label.
 */
export default function SearchField({ label, value, onChange }) {
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
      </span>
    </div>
  );
}
