import { Chess } from 'chess.js';

/** Quanto vale ogni pezzo, in pedoni. Il Re non si conta: non si perde, si perde la partita. */
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Sopra questa perdita (in pedoni) la mossa e' un regalo e non una mossa peggiore.
 *
 * Due pedoni: la qualita' entra, un pedone avvelenato no. Sotto ci sono ancora sacrifici
 * e imprecisioni che un giocatore vero fa; sopra c'e' il pezzo lasciato in presa, che a
 * milleottocento punti Elo non si vede quasi mai.
 */
export const GIVEAWAY = 2;

/**
 * Quanto materiale regala una mossa, in pedoni, guardando solo la risposta immediata.
 *
 * Perche' esiste: la Nonna sceglie fra le linee del motore, e alla sua profondita' una
 * Torre lasciata in presa puo' sembrarle una mossa come un'altra — la punizione arriva
 * una semi-mossa oltre il suo orizzonte. Il campionamento poi la pesca, e chi gioca vede
 * un avversario da millottocento punti mollare una Torre: la cosa che nessuno perdona
 * (segnalata giocando, in posizioni di vantaggio dove le linee si fanno taglienti).
 *
 * Non e' un'analisi: e' il conto che fa a occhio chi gioca. Dopo la mossa si guarda la
 * cattura piu' ghiotta dell'avversario e, se si puo' riprendere, si toglie il valore del
 * pezzo che riprendiamo. Non sostituisce il motore, aggiunge il controllo che il motore
 * a quella profondita' non fa.
 */
export function giveaway(fen: string, uci: string): number {
  let chess;
  try {
    chess = new Chess(fen);
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
    });
  } catch {
    // Posizione o mossa che non si possono leggere: qui non si giudica, si lascia passare.
    return 0;
  }
  let worst = 0;
  for (const capture of chess.moves({ verbose: true })) {
    if (!capture.captured) continue;
    const won = VALUE[capture.captured] ?? 0;
    if (won <= worst) continue;
    const after = new Chess(chess.fen());
    after.move({ from: capture.from, to: capture.to, ...(capture.promotion ? { promotion: capture.promotion } : {}) });
    // Se possiamo riprendere su quella casa, il conto e' lo scambio, non la cattura.
    const back = after
      .moves({ verbose: true })
      .filter((move) => move.to === capture.to && move.captured)
      .map((move) => VALUE[move.piece] ?? 0)
      .sort((a, b) => a - b)[0];
    const net = back === undefined ? won : won - (VALUE[capture.piece] ?? 0);
    if (net > worst) worst = net;
  }
  return worst;
}

/**
 * Vero se la mossa regala materiale che la MIGLIORE non regalava.
 *
 * Il confronto con la migliore e' necessario: se un pezzo e' gia' in presa e non si puo'
 * salvare, ogni mossa lo lascia li', e rifiutarle tutte non avrebbe senso.
 */
export function hangsMaterial(fen: string, uci: string, best: string): boolean {
  return giveaway(fen, uci) - giveaway(fen, best) >= GIVEAWAY;
}
