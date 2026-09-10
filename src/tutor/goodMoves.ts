import { Chess } from 'chess.js';

/**
 * Una mossa che non merita una lode, anche se la migliore batteva di molto la seconda.
 *
 * La post-analisi loda le mosse "difficili": quelle in cui la migliore valeva molto
 * piu' della seconda, e tu hai preso la migliore. Ma lo scarto dice solo quanto era
 * peggiore l'alternativa, non se era una TENTAZIONE. In una partita vera e' stata lodata
 * cosi' una mossa di Re sotto scacco, con due mosse legali in tutto: l'altra metteva una
 * Torre in presa con lo stesso scacco. "C'era una sola mossa buona, e tu l'hai trovata"
 * detto li' e' falso, perche' non c'era niente da trovare.
 *
 * Due casi, entrambi senza motore:
 *  - poche mosse legali: con tre o meno la scelta e' quasi obbligata;
 *  - la ripresa: catturare sulla casa dove l'avversario ha appena catturato. Lo scarto
 *    e' enorme — non riprendere perde il pezzo — ma e' la mossa che fa chiunque.
 */

/** Oltre questo numero di mosse legali c'e' una scelta vera. */
const FORCED_MAX_MOVES = 3;

export function obviousMove(
  fenBefore: string,
  from: string,
  to: string,
  previous?: { readonly to: string; readonly san: string },
): boolean {
  const chess = new Chess(fenBefore);
  const moves = chess.moves({ verbose: true });
  if (moves.length <= FORCED_MAX_MOVES) return true;
  const played = moves.find((move) => move.from === from && move.to === to);
  const recapture =
    played?.captured !== undefined && previous !== undefined && previous.to === to && previous.san.includes('x');
  return recapture;
}
