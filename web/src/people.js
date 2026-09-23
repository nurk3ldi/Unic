/**
 * Как проект показывает людей. Правило одно на все экраны: списки узкие,
 * полное ФИО в них не помещается, а обрезанное посередине читать нельзя.
 */

/** «Нурланова Айгерим Ержанқызы» → «Айгерим Н.» */
export function shortName(fullName) {
  const [last, first] = fullName.trim().split(/\s+/);
  return first ? `${first} ${last[0]}.` : last;
}

/** Буква для кружка-аватара */
export const initial = (fullName) => fullName.trim()[0].toUpperCase();

/**
 * Цвет имени в чате. Считается из id автора, а не раздаётся по порядку:
 * тогда у человека он один и тот же в любом чате и после перезагрузки.
 */
export function authorColor(id = '') {
  // FNV-1a: у id общая форма (hex и дефисы на тех же местах), и простая сумма
  // символов складывала бы почти всех в один цвет — нужна настоящая перемешка
  let hash = 2166136261;
  for (const char of id) hash = (Math.imul(hash, 16777619) ^ char.charCodeAt(0)) >>> 0;
  return `var(--author-${(hash % 6) + 1})`;
}
