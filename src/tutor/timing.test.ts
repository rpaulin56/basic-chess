import { describe, expect, it } from 'vitest';
import { hastiest, usualThinking, type TimedMove } from './timing.js';

const times = (values: readonly number[]): TimedMove[] =>
  values.map((ms, index) => ({ ply: index * 2, ms, interrupted: false }));

const all = (): boolean => true;

describe('il tempo solito', () => {
  it('e la mediana, e una pausa lunghissima non la sposta', () => {
    const regular = times([5000, 7000, 9000, 11000, 13000, 15000, 17000, 19000, 21000]);
    expect(usualThinking(regular, all)).toBe(13000);
    const withPause = times([5000, 7000, 9000, 11000, 13000, 15000, 17000, 19000, 1_200_000]);
    expect(usualThinking(withPause, all)).toBe(13000);
  });

  it('con un numero pari di mosse fa la media delle due centrali', () => {
    expect(usualThinking(times([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]), all)).toBe(4500);
  });

  it('non conta i turni interrotti ne le mosse escluse', () => {
    const list = [
      ...times([10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000]),
      { ply: 100, ms: 999_000, interrupted: true },
      { ply: 102, ms: 1, interrupted: false },
    ];
    expect(usualThinking(list, (ply) => ply !== 102)).toBe(10000);
  });

  it('con meno di otto mosse contate non c e ancora un solito', () => {
    expect(usualThinking(times([1000, 2000, 3000, 4000, 5000, 6000, 7000]), all)).toBeNull();
  });
});

describe('la mossa giocata di fretta', () => {
  const list = times([12000, 3000, 5000, 20000]);

  it('sceglie la piu costosa fra quelle sotto la meta del solito', () => {
    const found = hastiest(list, [{ ply: 2, drop: 25 }, { ply: 4, drop: 40 }, { ply: 6, drop: 60 }], 14000);
    expect(found).toEqual({ move: { ply: 4, drop: 40 }, ms: 5000 });
  });

  it('non dice niente se nessuna mossa costosa e stata veloce', () => {
    expect(hastiest(list, [{ ply: 0, drop: 30 }, { ply: 6, drop: 30 }], 14000)).toBeNull();
  });

  it('non dice niente a chi gioca sempre veloce', () => {
    expect(hastiest(list, [{ ply: 2, drop: 30 }], 5000)).toBeNull();
  });

  it('ignora i tempi interrotti', () => {
    const interrupted: TimedMove[] = [{ ply: 2, ms: 1000, interrupted: true }];
    expect(hastiest(interrupted, [{ ply: 2, drop: 30 }], 14000)).toBeNull();
  });
});
