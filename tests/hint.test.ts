import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { buildHint, HINT_MARGIN } from '../src/tutor/hint.js';
import type { Analysis, EngineLine } from '../src/engine/types.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function line(multipv: number, scoreCp: number, uci: string): EngineLine {
  return { multipv, scoreCp, mateIn: null, pv: [uci] };
}

function analysis(lines: EngineLine[], fen = START): Analysis {
  return { fen, depth: 12, lines, bestMove: lines[0]?.pv[0] ?? null };
}

describe('buildHint', () => {
  it("non conta le mosse che perdono piu' del margine", () => {
    // 0 e -20 centipawn distano circa 4 punti di aspettativa: dentro il margine.
    // -400 ne dista molti di piu' e deve restare fuori.
    const hint = buildHint(
      analysis([line(1, 0, 'e2e4'), line(2, -20, 'd2d4'), line(3, -400, 'a2a3')]),
    );
    expect(hint?.count).toBe(2);
    expect(hint?.moves).toEqual(['d4', 'e4']);
  });

  it('ordina alfabeticamente e non per valore', () => {
    // Il motore le da' in ordine di merito: g4 e' la migliore, ma non deve uscire per
    // prima, altrimenti l'elenco diventa una classifica con un vincitore.
    const hint = buildHint(
      analysis([line(1, 10, 'g2g4'), line(2, 5, 'a2a4'), line(3, 0, 'e2e4')]),
    );
    expect(hint?.moves).toEqual(['a4', 'e4', 'g4']);
  });

  it('distingue le tre forme della posizione', () => {
    const only = buildHint(analysis([line(1, 0, 'e2e4'), line(2, -600, 'a2a3')]));
    expect(only?.shape).toBe('only');

    const few = buildHint(
      analysis([line(1, 0, 'e2e4'), line(2, -10, 'd2d4'), line(3, -800, 'a2a3')]),
    );
    expect(few?.shape).toBe('few');

    const many = buildHint(
      analysis(
        ['e2e4', 'd2d4', 'g1f3', 'c2c4', 'b1c3', 'g2g3'].map((uci, index) =>
          line(index + 1, -index, uci),
        ),
      ),
    );
    expect(many?.shape).toBe('many');
  });

  it("dice che il conteggio e' un minimo se la ricerca era piu' stretta", () => {
    // Tre linee tutte accettabili, ma dalla posizione iniziale di mosse ce ne sono 20:
    // dire "sono tre" sarebbe falso, sono almeno tre.
    const hint = buildHint(analysis([line(1, 0, 'e2e4'), line(2, -5, 'd2d4'), line(3, -8, 'g1f3')]));
    expect(hint?.atLeast).toBe(true);

    // Se invece il motore ha visto tutte le mosse legali il numero e' esatto.
    const mateIn1 = '7k/5ppp/8/8/8/8/5PPP/6KR w - - 0 1';
    const wide = buildHint(
      analysis(
        new Chess(mateIn1).moves({ verbose: true }).map((move, index) =>
          line(index + 1, index === 0 ? 0 : -900, `${move.from}${move.to}`),
        ),
        mateIn1,
      ),
    );
    expect(wide?.atLeast).toBe(false);
  });

  it('non risponde se il motore non ha linee', () => {
    expect(buildHint(analysis([]))).toBeNull();
  });

  it('usa lo stesso margine del tutor', () => {
    expect(HINT_MARGIN).toBe(8);
  });
});