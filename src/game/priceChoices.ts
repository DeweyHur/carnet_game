/** Four distinct prices, one exact answer, with a reproducible shuffled order. */
export function priceChoices(actual: number, seed: string): number[] {
  const cents = Math.max(1, Math.round(actual * 100));
  const values = new Set([cents]);
  for (const factor of [0.6, 1.45, 1.9]) {
    let value = Math.max(1, Math.round(cents * factor / 10) * 10);
    while (values.has(value)) value += 10;
    values.add(value);
  }
  const choices = [...values].map((v) => v / 100);
  let hash = [...seed].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 17);
  for (let i = choices.length - 1; i > 0; i--) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    const j = hash % (i + 1);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}
