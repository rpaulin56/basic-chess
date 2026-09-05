import type { Analysis } from '../engine/types.js';
import { winPercentOf } from '../engine/winProb.js';

/**
 * Il bot "addomesticato".
 *
 * Perche' non UCI_LimitStrength: Stockfish indebolito con quel meccanismo parte da
 * ~1320 Elo e soprattutto sbaglia in modo DISUMANO — gioca quasi sempre da maestro e
 * ogni tanto lascia un pezzo senza ragione. Un principiante non impara nulla contro
 * un avversario cosi': non ci sono piani da capire, solo regali da aspettare.
 *
 * Qui invece si chiede al motore le N mosse migliori a profondita' bassa e si sceglie
 * fra quelle con un campionamento pesato: le mosse che perdono poco restano probabili,
 * quelle che perdono molto diventano improbabili ma non impossibili. Il risultato e'
 * un avversario che gioca mosse SENSATE ma non ottimali — cioe' come un umano debole.
 *
 * Questo modulo e' una funzione pura con generatore casuale iniettabile: e' quello che
 * permette allo script di calibrazione di farlo giocare contro se stesso migliaia di
 * volte in modo riproducibile.
 */

export interface BotLevel {
  readonly id: string;
  /** Elo dichiarato: e' una STIMA da verificare con la calibrazione, non un dato. */
  readonly nominalElo: number;
  /** Profondita' di ricerca: il primo e piu' grossolano regolatore di forza. */
  readonly depth: number;
  /** Quante alternative considerare. Sotto 3 il campionamento non ha spazio. */
  readonly multiPV: number;
  /**
   * "Temperatura" in punti percentuali di probabilita' di vittoria: quanto costa a
   * una mossa, in probabilita' di essere scelta, il fatto di perdere terreno.
   * Bassa = quasi sempre la mossa migliore. Alta = sceglie spesso alternative scadenti.
   */
  readonly temperature: number;
  /**
   * Probabilita' di una svista vera e propria: sceglie deliberatamente la PEGGIORE
   * fra le alternative considerate. Serve perche' un principiante non sbaglia solo
   * "un po' ovunque": ogni tanto fa proprio una papera, e senza questo il bot
   * risulterebbe innaturalmente uniforme.
   */
  readonly blunderRate: number;
}

/**
 * I livelli, con l'Elo MISURATO (non ipotizzato) da `npm run calibrate`, 20 partite per
 * livello contro Stockfish limitato a 1320 Elo — il piu' debole che sappia produrre.
 *
 * Cosa ha insegnato la calibrazione, e che vale la pena non riscoprire:
 *  - la prima ipotesi era sbagliata di 400-500 punti: "profondita' 4" suona debole ma
 *    e' gia' un giocatore da ~1100. Fidarsi dei numeri a occhio non funziona.
 *  - a contare non e' tanto la profondita' quanto TEMPERATURA e frequenza di papere:
 *    a parita' di temperatura, passare da profondita' 5 a 6 non ha spostato la misura;
 *    abbassare la temperatura da 15 a 12 l'ha spostata di oltre 200 punti.
 *
 * Attenzione all'attendibilita': sotto i 1320 la stima e' un'estrapolazione dal
 * punteggio, e piu' il livello e' debole meno e' precisa (il livello "principiante"
 * perde praticamente tutte le partite contro l'ancoraggio, quindi il suo Elo e'
 * misurato per confronto interno con "facile", non contro Stockfish).
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { id: 'principiante', nominalElo: 600, depth: 2, multiPV: 8, temperature: 35, blunderRate: 0.2 },
  { id: 'facile', nominalElo: 810, depth: 3, multiPV: 6, temperature: 28, blunderRate: 0.15 },
  { id: 'medio', nominalElo: 1105, depth: 4, multiPV: 5, temperature: 22, blunderRate: 0.14 },
  { id: 'discreto', nominalElo: 1230, depth: 5, multiPV: 5, temperature: 16, blunderRate: 0.07 },
  { id: 'club', nominalElo: 1470, depth: 6, multiPV: 4, temperature: 12, blunderRate: 0.035 },
];

export function levelById(id: string): BotLevel {
  return BOT_LEVELS.find((level) => level.id === id) ?? BOT_LEVELS[2]!;
}

export type Rng = () => number;

/**
 * Sceglie la mossa del bot fra le linee analizzate.
 * Restituisce una mossa in notazione UCI, o null se non c'e' nulla da giocare.
 */
export function selectBotMove(analysis: Analysis, level: BotLevel, rng: Rng = Math.random): string | null {
  const lines = analysis.lines.filter((line) => line.pv.length > 0);
  if (lines.length === 0) return analysis.bestMove;
  if (lines.length === 1) return lines[0]!.pv[0]!;

  // La svista: la peggiore fra le alternative CONSIDERATE, non una mossa a caso fra
  // tutte le legali. Un principiante che sbaglia gioca comunque una mossa che gli
  // sembrava sensata, non una mossa assurda.
  if (rng() < level.blunderRate) {
    return lines[lines.length - 1]!.pv[0]!;
  }

  const percents = lines.map(winPercentOf);
  const best = Math.max(...percents);
  const weights = percents.map((percent) => Math.exp(-(best - percent) / level.temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let threshold = rng() * total;
  for (let i = 0; i < lines.length; i++) {
    threshold -= weights[i]!;
    if (threshold <= 0) return lines[i]!.pv[0]!;
  }
  return lines[0]!.pv[0]!;
}
