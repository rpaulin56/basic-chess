import { PIECE_VALUE, afterMove, bestGrab } from '../core/material.js';

/**
 * Un fatto sul materiale, abbastanza sicuro da dirlo con precisione.
 *
 * - 'lost':   dopo la tua mossa l'avversaria ti prende subito qualcosa che, con la mossa
 *             migliore, non ti avrebbe preso. `move` e' la sua cattura.
 * - 'missed': la mossa migliore prendeva qualcosa, e tu non l'hai preso. `move` e' la
 *             cattura che c'era.
 */
export interface MaterialFact {
  readonly kind: 'lost' | 'missed';
  readonly piece: 'p' | 'n' | 'b' | 'r' | 'q';
  readonly move: string;
}

/** Sotto questo saldo (in pedoni) non si parla di materiale: un pedone non e' un fatto. */
const WORTH_SAYING = 2;

/**
 * Il fatto sul materiale fra la mossa giocata e la migliore, guardando SOLO la prima
 * risposta: una cattura e l'eventuale ripresa.
 *
 * E' il livello "certo" del piano "dire meno, mostrare meglio" (settembre 2026). Le frasi
 * di prima nascevano dalla coda di una variante del motore, e la coda cambia da una
 * profondita' all'altra: l'Alfiere diventava un Cavallo, una Torre "sfuggita" spariva a
 * profondita' piena. Qui non c'e' coda: c'e' quello che si vede sulla scacchiera, e si
 * vede allo stesso modo a qualunque profondita'. Tutto il resto — il pezzo che si perde
 * tre mosse dopo, la posizione che peggiora — non si dice con precisione: si mostra.
 *
 * Il motore resta il giudice del costo. Questa funzione dice solo CHE COSA, e solo quando
 * lo si puo' dire senza fidarsi di una previsione.
 */
export function materialFact(fenBefore: string, played: string, best: string | null): MaterialFact | null {
  if (!best || best === played) return null;
  const afterPlayed = afterMove(fenBefore, played);
  const afterBest = afterMove(fenBefore, best);
  if (!afterPlayed || !afterBest) return null;

  // Quanto rende una mossa a occhio: cio' che prende, meno cio' che l'avversaria prende subito.
  const taken = (after: ReturnType<typeof afterMove>): number => {
    const last = after?.history({ verbose: true }).at(-1);
    return last?.captured ? (PIECE_VALUE[last.captured] ?? 0) : 0;
  };
  const threatAfterPlayed = bestGrab(afterPlayed);
  const threatAfterBest = bestGrab(afterBest);
  const scorePlayed = taken(afterPlayed) - (threatAfterPlayed?.net ?? 0);
  const scoreBest = taken(afterBest) - (threatAfterBest?.net ?? 0);
  if (scoreBest - scorePlayed < WORTH_SAYING) return null;

  // Prima cio' che si perde: e' la cosa che si vede per prima sulla scacchiera.
  const extraThreat = (threatAfterPlayed?.net ?? 0) - (threatAfterBest?.net ?? 0);
  if (threatAfterPlayed && extraThreat >= WORTH_SAYING) {
    return { kind: 'lost', piece: threatAfterPlayed.captured, move: threatAfterPlayed.san };
  }
  const bestCapture = afterBest.history({ verbose: true }).at(-1);
  if (bestCapture?.captured && taken(afterBest) - taken(afterPlayed) >= WORTH_SAYING) {
    return { kind: 'missed', piece: bestCapture.captured as MaterialFact['piece'], move: bestCapture.san };
  }
  return null;
}
