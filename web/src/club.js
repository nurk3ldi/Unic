export const STATUS_LABELS = {
  active: 'Активен',
  pending: 'На рассмотрении',
  suspended: 'Закрыт',
};

/** Форма слова для числа по-русски: 1 клуб, 2 клуба, 5 клубов (11–14 — всегда «много») */
export function plural(count, [one, few, many]) {
  const ten = count % 10;
  const hundred = count % 100;
  if (ten === 1 && hundred !== 11) return one;
  if (ten >= 2 && ten <= 4 && (hundred < 10 || hundred >= 20)) return few;
  return many;
}

/** 1 участник, 2 участника, 5 участников */
export function membersLabel(count) {
  if (!count) return 'Нет участников';
  return `${count} ${plural(count, ['участник', 'участника', 'участников'])}`;
}
