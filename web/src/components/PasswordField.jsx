import { useState } from 'react';
import { IoEyeOffOutline, IoEyeOutline } from 'react-icons/io5';
import Field from './Field.jsx';
import './PasswordField.css';

/** Поле пароля со скрытием и показом содержимого. */
export default function PasswordField({ label = 'Пароль', ...rest }) {
  const [shown, setShown] = useState(false);

  return (
    <Field
      label={label}
      type={shown ? 'text' : 'password'}
      trailing={
        <button
          className="password-toggle"
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
          aria-pressed={shown}
        >
          {shown ? <IoEyeOffOutline /> : <IoEyeOutline />}
        </button>
      }
      {...rest}
    />
  );
}
