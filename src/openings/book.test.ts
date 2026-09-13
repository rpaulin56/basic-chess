import { describe, expect, it } from 'vitest';
import { arrowMoves, type BookMove } from './book.js';

describe('le frecce da disegnare', () => {
  const start: BookMove[] = [
    { san: 'e4', share: 64 },
    { san: 'd4', share: 23 },
    { san: 'c4', share: 3 },
    { san: 'Nf3', share: 2 },
    { san: 'e3', share: 2 },
  ];

  it('alla prima mossa mostra anche Inglese e Reti', () => {
    expect(arrowMoves(start, 0).map((move) => move.san)).toEqual(['e4', 'd4', 'c4', 'Nf3', 'e3']);
  });

  it('piu' + "'" + ' si scende, piu' + "'" + ' stringe sulle principali', () => {
    // Le stesse quote a due profondita' diverse: alla prima semi-mossa la soglia e' 95 e
    // le prende tutte, piu' avanti e' 85 e l'ultima resta fuori.
    const spread: BookMove[] = [
      { san: 'Bc4', share: 40 },
      { san: 'Bb5', share: 25 },
      { san: 'd4', share: 12 },
      { san: 'O-O', share: 10 },
      { san: 'Nc3', share: 8 },
    ];
    expect(arrowMoves(spread, 0)).toHaveLength(5);
    expect(arrowMoves(spread, 4).map((move) => move.san)).toEqual(['Bc4', 'Bb5', 'd4', 'O-O']);
    expect(arrowMoves(spread, 10).map((move) => move.san)).toEqual(['Bc4', 'Bb5', 'd4', 'O-O']);
  });

  it('dove c e una mossa sola disegna una freccia sola', () => {
    expect(arrowMoves([{ san: 'Nxd4', share: 89 }, { san: 'Qxd4', share: 7 }], 6)).toHaveLength(1);
  });

  it('con quote che non arrivano alla soglia le prende tutte', () => {
    const thin: BookMove[] = [{ san: 'e4', share: 30 }, { san: 'd4', share: 25 }];
    expect(arrowMoves(thin, 2)).toHaveLength(2);
  });
});
