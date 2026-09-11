import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import type { Analysis, EngineLine } from '../engine/types.js';
import { detectMistake, isImportant } from './detect.js';

/**
 * La "mossa unica" non scusa chi non ha preso un pezzo.
 *
 * Partita vera (Pirc, livello 4 attenta): dopo 16...Nxd5 la Donna nera in a5 e' in presa
 * dell'Alfiere in b6. 17.Bxa5 era l'unica mossa buona, 17.Qxf7+?? e' costata trenta punti,
 * e il tutor taceva perche' "si salvava soltanto con quella".
 */
describe('mossa unica', () => {
  const game = new Chess();
  const moves =
    'd4 d6 e4 Nf6 Bd3 g6 Nc3 Nbd7 Bd2 c6 Qf3 Bg7 Nge2 a6 O-O-O Qc7 Bf4 c5 dxc5 Qxc5 Be3 Qb4 a3 Qa5 Nd5 Ne5 Qf4 b5 Bb6 Nxd3+ Rxd3 Nxd5';
  for (const san of moves.split(' ')) game.move(san);
  const BEFORE_17 = game.fen();

  const line = (multipv: number, scoreCp: number, pv: string[]): EngineLine => ({ multipv, scoreCp, mateIn: null, pv });
  // Tre linee come quelle del tutor: una sola buona, le altre due come la mossa giocata.
  const analysisBefore = (best: string): Analysis => ({
    fen: BEFORE_17,
    depth: 17,
    bestMove: best,
    lines: [line(1, 30, [best]), line(2, -250, ['e4d5']), line(3, -260, ['f4f7'])],
  });
  // Dopo la mossa giocata tocca al Nero, che sta nettamente meglio.
  const analysisAfter: Analysis = { fen: BEFORE_17, depth: 17, bestMove: null, lines: [line(1, 250, ['e8f7'])] };

  it("se l'unica mossa buona prende un pezzo, l'errore si segnala", () => {
    const verdict = detectMistake(analysisBefore('b6a5'), analysisAfter);
    expect(verdict.skipped).toBeNull();
    expect(isImportant(verdict)).toBe(true);
  });

  it("se l'unica mossa buona non prende niente, resta perdonata", () => {
    const verdict = detectMistake(analysisBefore('c1b1'), analysisAfter);
    expect(verdict.skipped).toBe('onlyMove');
  });
});
