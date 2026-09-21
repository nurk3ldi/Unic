/** Русские числовые формы: plural(1, ['клуб','клуба','клубов']) → 'клуб' */
export function plural(count, [one, few, many]) {
  const ten = count % 10;
  const hundred = count % 100;
  if (ten === 1 && hundred !== 11) return one;
  if (ten >= 2 && ten <= 4 && (hundred < 10 || hundred >= 20)) return few;
  return many;
}
