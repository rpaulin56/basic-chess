import { afterMove, bestGrab } from '../core/material.js';

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
  const after = afterMove(fen, uci);
  return after ? (bestGrab(after)?.net ?? 0) : 0;
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
