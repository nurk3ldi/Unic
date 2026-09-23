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
