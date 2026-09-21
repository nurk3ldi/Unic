import { useEffect, useState } from 'react';
import {
  IoEllipsisHorizontal,
  IoInformationCircleOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import './ClubCard.css';

const STATUS_LABELS = {
  active: 'Активен',
  pending: 'На рассмотрении',
  suspended: 'Закрыт',
};

/** Русские формы: 1 участник, 2 участника, 5 участников */
function membersLabel(count) {
  if (!count) return 'Нет участников';
  const ten = count % 10;
  const hundred = count % 100;
  if (ten === 1 && hundred !== 11) return `${count} участник`;
  if (ten >= 2 && ten <= 4 && (hundred < 10 || hundred >= 20)) return `${count} участника`;
  return `${count} участников`;
}

/** Карточка клуба. Шапка по образцу виджетов: название, строка контекста, действие. */
export default function ClubCard({ name, members = 0, status = 'active' }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Меню закрывается кликом вне и клавишей Esc
  useEffect(() => {
    if (!menuOpen) return undefined;

    const close = () => setMenuOpen(false);
    const onKey = (event) => event.key === 'Escape' && close();

    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <article className="club">
      <div className="club__header">
        <div className="club__title">
          <h2 className="club__name">{name}</h2>
          <p className="club__meta">
            {membersLabel(members)} · {STATUS_LABELS[status] ?? status}
          </p>
        </div>

        <button
          className="club__more"
          type="button"
          aria-expanded={menuOpen}
          aria-label="Действия с клубом"
          onClick={(event) => {
            event.stopPropagation(); // иначе тот же клик сразу закроет меню
            setMenuOpen((open) => !open);
          }}
        >
          <IoEllipsisHorizontal aria-hidden="true" />
        </button>

        {menuOpen && (
          <div className="club__menu" role="menu">
            <button className="club__menu-item" type="button" role="menuitem">
              <IoSettingsOutline aria-hidden="true" />
              Опция 1
            </button>
            <button className="club__menu-item" type="button" role="menuitem">
              <IoInformationCircleOutline aria-hidden="true" />
              Опция 2
            </button>
          </div>
        )}
      </div>

      <div className="club__body" />
    </article>
  );
}
