import { describe, expect, it } from 'vitest';
import { obviousMove } from '../src/tutor/goodMoves.js';

/**
 * Le mosse che la post-analisi non deve lodare. I primi due casi vengono da una partita
 * vera, dove entrambe comparivano come "una sola mossa buona, e tu l'hai trovata".
 */
describe('obviousMove', () => {
  it('sotto scacco con due mosse legali non c\'e\' niente da trovare', () => {
    // Prima di 44.Kg1: l'unica alternativa era Rf3, presa subito con Qxf3+.
    expect(obviousMove('1r3k2/2p4p/4Q1p1/1r2P3/1P2qP2/PR4P1/7P/2R4K w - - 1 44', 'h1', 'g1')).toBe(true);
  });

  it('riprendere il pezzo appena preso non e\' un merito', () => {
    // Prima di 48.Rxc6, dopo 47...Qxc6.
    expect(
      obviousMove('1r2k3/2p4p/2q5/4P1p1/1P3P2/1R4P1/7P/2R3K1 w - - 0 48', 'c1', 'c6', { to: 'c6', san: 'Qxc6' }),
    ).toBe(true);
  });

  it('una mossa tranquilla con molte alternative resta una scelta', () => {
    expect(
      obviousMove('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'g1', 'f3', { to: 'e5', san: 'e5' }),
    ).toBe(false);
  });

  it('una cattura che non riprende niente resta una scelta', () => {
    expect(
      obviousMove('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'e4', 'd5', { to: 'd5', san: 'd5' }),
    ).toBe(false);
  });
});
