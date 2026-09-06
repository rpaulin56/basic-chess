import type { Analysis, EngineLine } from '../engine/types.js';
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
 * livello contro Stockfish limitato a un Elo noto.
 *
 * Cosa ha insegnato la calibrazione, e che vale la pena non riscoprire:
 *  - la prima ipotesi era sbagliata di 400-500 punti: "profondita' 4" suona debole ma
 *    e' gia' un giocatore da oltre 1200. Fidarsi dei numeri a occhio non funziona.
 *  - contano molto piu' TEMPERATURA e frequenza di papere che la profondita'... ma
 *    solo finche' la partita e' in bilico. Da quando il bot converte davvero le
 *    posizioni decise (vedi moveCost), alzare la temperatura sposta poco e la
 *    PROFONDITA' e' tornata a essere il regolatore principale: tutta la scala si e'
 *    dovuta spostare di un gradino di profondita' verso il basso.
 *  - la correzione al criterio di scelta ha spostato "medio" da 1080 a 1337 e "club"
 *    da 1470 a 1832 senza toccare un solo parametro dei livelli. Ogni modifica al
 *    modo in cui il bot sceglie le mosse invalida la scala e va seguita da una
 *    rimisurazione: i numeri qui sotto sono un risultato sperimentale, non una scelta.
 *
 * Attenzione all'attendibilita': sotto i 1320 la stima e' un'estrapolazione dal
 * punteggio, e piu' il livello e' debole meno e' precisa ("principiante" e' misurato
 * per confronto interno con "facile", non contro Stockfish). Sopra vale il problema
 * simmetrico: i livelli forti si misurano contro un ancoraggio piu' alto, altrimenti
 * vincono tutto e la stima e' aria fritta.
 *
 * Quanto e' ripetibile: "medio" misurato due volte a distanza ha dato 1105 e 1051.
 * Venti partite bastano per collocare un livello, non per distinguerne due vicini.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { id: 'principiante', nominalElo: 690, depth: 2, multiPV: 8, temperature: 45, blunderRate: 0.3 },
  { id: 'facile', nominalElo: 880, depth: 2, multiPV: 8, temperature: 32, blunderRate: 0.22 },
  { id: 'medio', nominalElo: 1080, depth: 3, multiPV: 6, temperature: 30, blunderRate: 0.18 },
  { id: 'discreto', nominalElo: 1300, depth: 4, multiPV: 5, temperature: 22, blunderRate: 0.1 },
  { id: 'club', nominalElo: 1535, depth: 5, multiPV: 5, temperature: 16, blunderRate: 0.06 },
  { id: 'esperto', nominalElo: 1765, depth: 6, multiPV: 4, temperature: 13, blunderRate: 0.035 },
  // Misurati contro l'ancoraggio a 1800, non a 1320: contro il piu' debole vincevano
  // tutte le partite e la stima sarebbe stata solo un'estrapolazione senza senso.
  { id: 'forte', nominalElo: 2436, depth: 8, multiPV: 3, temperature: 8, blunderRate: 0.015 },
];

export function levelById(id: string): BotLevel {
  return BOT_LEVELS.find((level) => level.id === id) ?? BOT_LEVELS[2]!;
}

export type Rng = () => number;

/**
 * Valutazione in centipawn "estesa": un matto diventa un numero grandissimo, tanto
 * piu' grande quanto piu' e' vicino. Serve perche' altrimenti tutti i matti si
 * equivalgono e il bot puo' preferire il matto in 8 a quello in 1.
 */
function extendedCp(line: EngineLine): number {
  if (line.mateIn === null) return line.scoreCp ?? 0;
  return line.mateIn > 0 ? 100_000 - line.mateIn * 100 : -100_000 - line.mateIn * 100;
}

/**
 * Quanti centipawn valgono un punto di costo. Con 10, in posizione equilibrata il
 * termine in centipawn e' quasi identico a quello in aspettativa (100 cp valgono
 * circa 9 punti di aspettativa attorno alla parita'): i due criteri si saldano senza
 * gradini.
 */
const CP_PER_POINT = 10;

/**
 * Oltre questo vantaggio (in pedoni) la partita e' decisa, e il bot cambia registro.
 */
const DECIDED_PAWNS = 3;

/**
 * Quanto costa una mossa rispetto alla migliore.
 *
 * Il massimo fra due misure, e non e' un dettaglio: l'aspettativa di vittoria e'
 * quella giusta per giudicare gli ERRORI di un umano (da +9 a +7 non cambia nulla) ma
 * e' pessima per SCEGLIERE una mossa in posizione decisa, perche' satura. Misurato:
 * fra +18 e +10 — una donna intera — l'aspettativa distingue 2,3 punti, cioe' quasi
 * nulla, e il bot finiva per sorteggiare fra le linee. E' esattamente il difetto per
 * cui non prendeva le donne in presa quando stava perdendo o vincendo largamente.
 *
 * Il termine in centipawn non satura mai e riprende in mano la scelta appena
 * l'aspettativa smette di dire qualcosa.
 */
function moveCost(best: EngineLine, line: EngineLine): number {
  const byExpectancy = winPercentOf(best) - winPercentOf(line);
  const byCentipawns = (extendedCp(best) - extendedCp(line)) / CP_PER_POINT;
  return Math.max(0, Math.max(byExpectancy, byCentipawns));
}

/**
 * Sceglie la mossa del bot fra le linee analizzate.
 * Restituisce una mossa in notazione UCI, o null se non c'e' nulla da giocare.
 */
export function selectBotMove(analysis: Analysis, level: BotLevel, rng: Rng = Math.random): string | null {
  const lines = analysis.lines.filter((line) => line.pv.length > 0);
  if (lines.length === 0) return analysis.bestMove;
  if (lines.length === 1) return lines[0]!.pv[0]!;

  const best = lines[0]!;

  // Partita decisa: il bot stringe i denti, con meno casualita' e molte meno papere.
  //
  // E' una deviazione DELIBERATA dal realismo, chiesta e motivata: portare a termine
  // una posizione vinta e' fra le cose piu' difficili da imparare, e allenarsi contro
  // un avversario che le butta via non insegna niente. Vale anche a parti rovesciate,
  // perche' un bot che perde e per giunta smette di prendere i pezzi in presa e'
  // semplicemente sgradevole da guardare.
  const decided = Math.abs(extendedCp(best)) / 100 >= DECIDED_PAWNS;
  const temperature = decided ? level.temperature * 0.4 : level.temperature;
  const blunderRate = decided ? level.blunderRate * 0.25 : level.blunderRate;

  // La svista: la peggiore fra le alternative CONSIDERATE, non una mossa a caso fra
  // tutte le legali. Un principiante che sbaglia gioca comunque una mossa che gli
  // sembrava sensata, non una mossa assurda.
  if (rng() < blunderRate) {
    return lines[lines.length - 1]!.pv[0]!;
  }

  const weights = lines.map((line) => Math.exp(-moveCost(best, line) / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let threshold = rng() * total;
  for (let i = 0; i < lines.length; i++) {
    threshold -= weights[i]!;
    if (threshold <= 0) return lines[i]!.pv[0]!;
  }
  return lines[0]!.pv[0]!;
}
