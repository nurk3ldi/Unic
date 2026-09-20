import { useId } from 'react';
import './Field.css';

/**
 * Поле ввода: подпись живёт внутри поля (placeholder), снаружи её нет.
 * Для скринридера остаётся скрытый <label>.
 * `trailing` — слот для кнопки справа (например, показ пароля).
 */
export default function Field({ label, error, trailing, className = '', ...rest }) {
  const id = useId();

  return (
    <div className="field">
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>

      <div className={`field__box${error ? ' field__box--error' : ''}`}>
        <input
          id={id}
          className={`field__input ${className}`.trim()}
          placeholder={label}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
        {trailing}
      </div>

      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
