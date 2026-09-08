import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { detectMistake } from '../src/tutor/detect.js';
import type { Analysis } from '../src/engine/types.js';

/**
 * La mossa che CHIUDE la partita deve essere giudicata come tutte le altre.
 *
 * Il caso viene da una partita vera: un matto in tre trasformato in stallo, e la
 * Nonna che non dice una parola. In una posizione finita il motore non produce
 * nessuna linea — giustamente, non ci sono mosse da cercare — e il filtro
 * "analisi troppo superficiale" buttava via il verdetto.
 */
const REVIEW_DEPTH = 17;

/** La stessa sintesi che fa l'applicazione: il risultato lo dicono le regole. */
function terminalAnalysis(fen: string): Analysis | null {
  const chess = new Chess(fen);
  if (!chess.isGameOver()) return null;
  const mated = chess.isCheckmate();
  return {
    fen,
    depth: REVIEW_DEPTH,
    bestMove: null,
    lines: [{ multipv: 1, scoreCp: mated ? null : 0, mateIn: mated ? -1 : null, pv: [] }],
  };
}

/** Una posizione vinta: matto forzato per chi ha il tratto. */
const vinta: Analysis = {
  fen: 'k7/8/1K6/8/7Q/8/8/8 w - - 0 1',
  depth: REVIEW_DEPTH,
  bestMove: 'h4d8',
  lines: [
    { multipv: 1, scoreCp: null, mateIn: 1, pv: ['h4d8'] },
    { multipv: 2, scoreCp: null, mateIn: 2, pv: ['h4e7'] },
    { multipv: 3, scoreCp: null, mateIn: 3, pv: ['h4h8'] },
  ],
};

describe('la mossa che chiude la partita', () => {
  it('lo stallo di una partita vinta e un errore grave', () => {
    const stallo = terminalAnalysis('k7/2Q5/1K6/8/8/8/8/8 b - - 1 1')!;
    const verdict = detectMistake(vinta, stallo);
    expect(verdict.skipped).toBeNull();
    expect(verdict.severity).toBe('blunder');
    expect(Math.round(verdict.drop)).toBe(50);
  });

  it('dare matto non costa niente', () => {
    const matto = terminalAnalysis('k2Q4/8/1K6/8/8/8/8/8 b - - 1 1')!;
    const verdict = detectMistake(vinta, matto);
    expect(Math.round(verdict.drop)).toBe(0);
    expect(verdict.severity).toBe('none');
  });

  it('una posizione ancora aperta non viene sintetizzata', () => {
    expect(terminalAnalysis('k7/8/1K6/8/7Q/8/8/8 w - - 0 1')).toBeNull();
  });
});
