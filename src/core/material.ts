import { Chess } from 'chess.js';

/** Quanto vale ogni pezzo, in pedoni. Il Re non si conta: non si perde, si perde la partita. */
export const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** La cattura piu' redditizia a disposizione di chi muove, col suo saldo netto. */
export interface Grab {
  /** Pedoni guadagnati al netto della ripresa, se c'e'. */
  readonly net: number;
  /** Il pezzo preso. */
  readonly captured: 'p' | 'n' | 'b' | 'r' | 'q';
  /** La cattura, in SAN. */
  readonly san: string;
}

/**
 * La cattura piu' ghiotta per chi ha il tratto, a occhio: si prende, e se l'altro puo'
 * riprendere sulla stessa casa si toglie il valore del pezzo che ha preso.
 *
 * Non e' un'analisi e non vuole esserlo. E' il conto che fa chi gioca guardando la
 * scacchiera, e ha il pregio che le analisi del motore non hanno: non dipende da quanto
 * a fondo si e' guardato, quindi non cambia da una profondita' all'altra. Serve dove
 * bisogna dire un FATTO ("il Cavallo resta in presa") e non una previsione.
 */
export function bestGrab(chess: Chess): Grab | null {
  let best: Grab | null = null;
  for (const capture of chess.moves({ verbose: true })) {
    if (!capture.captured) continue;
    const won = PIECE_VALUE[capture.captured] ?? 0;
    if (best && won <= best.net) continue;
    const after = new Chess(chess.fen());
    after.move({ from: capture.from, to: capture.to, ...(capture.promotion ? { promotion: capture.promotion } : {}) });
    const canTakeBack = after.moves({ verbose: true }).some((move) => move.to === capture.to && move.captured);
    const net = canTakeBack ? won - (PIECE_VALUE[capture.piece] ?? 0) : won;
    if (!best || net > best.net) {
      best = { net, captured: capture.captured as Grab['captured'], san: capture.san };
    }
  }
  return best && best.net > 0 ? best : null;
}

/** La posizione dopo una mossa in UCI, o null se la mossa non si puo' giocare. */
export function afterMove(fen: string, uci: string): Chess | null {
  try {
    const chess = new Chess(fen);
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}) });
    return chess;
  } catch {
    return null;
  }
}
