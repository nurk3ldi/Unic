import { useState } from 'react';
import {
  IconEye,
  IconEyeOff,
} from '../icons.jsx';
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
          <span className="password-toggle__icon" key={shown ? 'shown' : 'hidden'}>
            {shown ? <IconEyeOff /> : <IconEye />}
          </span>
        </button>
      }
      {...rest}
    />
  );
}
