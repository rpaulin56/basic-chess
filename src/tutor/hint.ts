import { Chess } from 'chess.js';
import type { Analysis } from '../engine/types.js';
import { winPercentOf } from '../engine/winProb.js';

/**
 * "E adesso cosa faccio?" — le mosse che non rovinano la posizione.
 *
 * Tre scelte di progetto, tutte deliberate e tutte in direzione contraria alla
 * comodita' immediata:
 *
 * 1. NIENTE CLASSIFICA. Le mosse escono in ordine alfabetico e senza punteggio.
 *    Ordinarle per valore creerebbe un podio, e un podio ha un vincitore: la prima
 *    diventerebbe "la risposta giusta" e le altre contorno, che e' esattamente il
 *    contrario di quello che l'elenco vuole dire. Con la classifica si finisce anche
 *    per imparare i gusti del motore invece di valutare la posizione.
 *
 * 2. IL NUMERO PRIMA DELLE MOSSE. Sapere QUANTE sono e' gia' una risposta, e spesso
 *    e' LA risposta: in una posizione tranquilla di mediogioco l'elenco di dodici
 *    mosse giocabili non serve a niente, mentre sapere che sono dodici sposta la
 *    domanda da "quale mossa" a "che piano voglio" — che e' la domanda giusta.
 *
 * 3. QUANDO LA MOSSA E' UNA SOLA, NON SI MOSTRA (al primo colpo). Una mossa sola vuol
 *    dire posizione tattica, e darla sarebbe risolvere l'esercizio.
 */

/**
 * Quanta aspettativa di vittoria si puo' perdere restando "ragionevoli", in punti
 * percentuali. E' la stessa soglia con cui il tutor conta le mosse che tenevano la
 * posizione (detect.ts, `alternativeMargin`): le due frasi devono contare nello
 * stesso modo, altrimenti il programma si contraddice da solo.
 */
export const HINT_MARGIN = 8;

/** Sopra questo numero la posizione non e' un problema da risolvere ma una scelta. */
const MANY_FROM = 5;

export type HintShape = 'only' | 'few' | 'many';

export interface Hint {
  readonly shape: HintShape;
  /** Quante mosse stanno dentro il margine. */
  readonly count: number;
  /** Vero se il motore aveva meno linee delle mosse legali: il conteggio e' un minimo. */
  readonly atLeast: boolean;
  /** Le mosse, in SAN, in ordine alfabetico. */
  readonly moves: readonly string[];
}

/**
 * Costruisce il suggerimento da un'analisi multi-linea. Restituisce null se l'analisi
 * non ha linee (posizione finita, o motore in avaria).
 */
export function buildHint(analysis: Analysis): Hint | null {
  if (analysis.lines.length === 0) return null;
  const best = analysis.lines[0]!;
  const bestPercent = winPercentOf(best);

  const chess = new Chess(analysis.fen);
  const legalCount = chess.moves().length;

  const moves: string[] = [];
  for (const line of analysis.lines) {
    if (bestPercent - winPercentOf(line) > HINT_MARGIN) break;
    const uci = line.pv[0];
    if (!uci) continue;
    const san = toSan(analysis.fen, uci);
    if (san) moves.push(san);
  }
  if (moves.length === 0) return null;

  moves.sort((a, b) => a.localeCompare(b));
  const count = moves.length;
  return {
    shape: count === 1 ? 'only' : count < MANY_FROM ? 'few' : 'many',
    count,
    // Se TUTTE le linee chieste sono risultate accettabili e il motore ne aveva meno
    // delle mosse legali, ce n'erano altre che non abbiamo visto: il numero e' un
    // minimo e va detto, altrimenti si dichiara una precisione che non si ha.
    atLeast: count === analysis.lines.length && analysis.lines.length < legalCount,
    moves,
  };
}

function toSan(fen: string, uci: string): string | null {
  const chess = new Chess(fen);
  try {
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
    });
    return move.san;
  } catch {
    return null;
  }
}
