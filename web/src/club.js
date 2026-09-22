export const STATUS_LABELS = {
  active: 'Активен',
  pending: 'На рассмотрении',
  suspended: 'Закрыт',
};

/** Русские формы: 1 участник, 2 участника, 5 участников */
export function membersLabel(count) {
  if (!count) return 'Нет участников';
  const ten = count % 10;
  const hundred = count % 100;
  if (ten === 1 && hundred !== 11) return `${count} участник`;
  if (ten >= 2 && ten <= 4 && (hundred < 10 || hundred >= 20)) return `${count} участника`;
  return `${count} участников`;
}
