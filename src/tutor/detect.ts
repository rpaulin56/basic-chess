import type { Analysis } from '../engine/types.js';
import { winPercentOf } from '../engine/winProb.js';

/**
 * Rilevamento dell'ERRORE IMPORTANTE.
 *
 * Funzione pura: riceve due analisi e la mossa giocata, restituisce un verdetto. Non
 * conosce ne' l'interfaccia ne' il motore — e' quello che permette di collaudarla su
 * posizioni note (vedi detect.test.ts) e di raffinarla senza toccare il resto.
 *
 * Il principio, gia' fissato in engine/winProb.ts: si misura in PROBABILITA' DI
 * VITTORIA, mai in centipawn. Perdere 200 centipawn quando si sta vincendo di regina
 * non e' un errore; perderli in posizione pari e' la partita.
 */

/** Gravita' crescente. `none` significa "non vale la pena disturbare l'utente". */
export type Severity = 'none' | 'inaccuracy' | 'mistake' | 'blunder';

/** Come cambia il "genere" della posizione: e' quello che l'utente percepisce davvero. */
export type Crossing = 'winToDraw' | 'winToLoss' | 'drawToLoss' | null;

export interface MistakeVerdict {
  readonly severity: Severity;
  /** Quanti punti percentuali di probabilita' di vittoria sono stati persi. */
  readonly drop: number;
  readonly winPercentBefore: number;
  readonly winPercentAfter: number;
  readonly crossing: Crossing;
  /** Mossa migliore secondo il motore (UCI) e suo seguito previsto. */
  readonly bestMove: string | null;
  readonly bestLine: readonly string[];
  /**
   * Quante fra le alternative analizzate erano SENSIBILMENTE migliori della mossa
   * giocata. Una sola significa "mossa unica": la posizione si salvava solo con
   * quella, e non e' onesto rimproverare un principiante per non averla trovata.
   */
  readonly betterAlternatives: number;
  /** Se il verdetto e' `none`, perche'. Utile per capire il comportamento del tutor. */
  readonly skipped: SkipReason | null;
}

export type SkipReason =
  | 'shallow' // analisi troppo superficiale per fidarsi
  | 'alreadyLost' // la posizione era gia' persa: non si impara nulla
  | 'stillWinning' // si vince comunque: non vale la pena interrompere
  | 'onlyMove' // si salvava solo con una mossa: non e' un errore, e' una posizione persa
  | 'tooSmall'; // scarto sotto la soglia

export interface DetectOptions {
  /** Scarto minimo (punti percentuali) per parlare di imprecisione. */
  readonly inaccuracy: number;
  /** Scarto minimo per un errore. */
  readonly mistake: number;
  /** Scarto minimo per un errore grave. */
  readonly blunder: number;
  /**
   * Sotto questa probabilita' di vittoria la posizione e' considerata gia' persa e il
   * tutor tace: passare da -4 a -6 non insegna niente a nessuno.
   */
  readonly alreadyLostBelow: number;
  /** Sopra questa probabilita' dopo la mossa si vince comunque: il tutor tace. */
  readonly stillWinningAbove: number;
  /** Quanto deve essere migliore un'alternativa per contare come "c'era di meglio". */
  readonly alternativeMargin: number;
  /** Profondita' minima delle due analisi perche' il verdetto sia attendibile. */
  readonly minDepth: number;
}

export const DEFAULT_OPTIONS: DetectOptions = {
  inaccuracy: 10,
  mistake: 18,
  blunder: 30,
  alreadyLostBelow: 12,
  stillWinningAbove: 88,
  alternativeMargin: 8,
  minDepth: 10,
};

/** Soglie di "genere" della posizione, in probabilita' di vittoria per chi muove. */
const WINNING_FROM = 70;
const LOSING_BELOW = 30;

function kindOf(winPercent: number): 'win' | 'draw' | 'loss' {
  if (winPercent >= WINNING_FROM) return 'win';
  if (winPercent <= LOSING_BELOW) return 'loss';
  return 'draw';
}

function crossingOf(before: number, after: number): Crossing {
  const from = kindOf(before);
  const to = kindOf(after);
  if (from === 'win' && to === 'draw') return 'winToDraw';
  if (from === 'win' && to === 'loss') return 'winToLoss';
  if (from === 'draw' && to === 'loss') return 'drawToLoss';
  return null;
}

/**
 * Valuta la mossa appena giocata.
 *
 * @param before analisi della posizione PRIMA della mossa (chi muove = chi sbaglia)
 * @param after  analisi della posizione DOPO la mossa (chi muove = l'avversario)
 */
export function detectMistake(
  before: Analysis,
  after: Analysis,
  options: DetectOptions = DEFAULT_OPTIONS,
): MistakeVerdict {
  const bestBefore = before.lines[0];
  const bestAfter = after.lines[0];

  const winPercentBefore = bestBefore ? winPercentOf(bestBefore) : 50;
  // Le valutazioni sono sempre dal punto di vista di chi ha il tratto: dopo la mossa
  // il tratto e' passato all'avversario, quindi va rovesciata per tornare al nostro.
  const winPercentAfter = bestAfter ? 100 - winPercentOf(bestAfter) : 50;
  const drop = winPercentBefore - winPercentAfter;

  const betterAlternatives = before.lines.filter(
    (line) => winPercentOf(line) >= winPercentAfter + options.alternativeMargin,
  ).length;

  const base = {
    drop,
    winPercentBefore,
    winPercentAfter,
    crossing: crossingOf(winPercentBefore, winPercentAfter),
    bestMove: bestBefore?.pv[0] ?? before.bestMove,
    bestLine: bestBefore?.pv ?? [],
    betterAlternatives,
  };
  const quiet = (skipped: SkipReason): MistakeVerdict => ({ ...base, severity: 'none', skipped });

  // I filtri anti-rumore, nell'ordine in cui contano. Senza questi il tutor
  // interviene di continuo e l'utente smette di ascoltarlo — che e' il modo piu'
  // sicuro di rendere inutile tutto il progetto.
  //
  // L'ordine non e' indifferente: prima si guarda il CONTESTO (era gia' persa? si
  // vince comunque?) e solo dopo l'entita' dello scarto. Una posizione gia' persa non
  // merita una segnalazione nemmeno quando lo scarto e' grande.
  if (before.depth < options.minDepth || after.depth < options.minDepth) return quiet('shallow');
  if (winPercentBefore < options.alreadyLostBelow) return quiet('alreadyLost');
  if (winPercentAfter > options.stillWinningAbove) return quiet('stillWinning');
  if (drop < options.inaccuracy) return quiet('tooSmall');
  // "Mossa unica": se fra le linee analizzate una sola era davvero migliore, la
  // posizione si salvava soltanto con quella. Rimproverare un principiante per non
  // aver trovato l'unica mossa e' ingiusto e diseducativo.
  //
  // Nota su una versione precedente di questo filtro, che chiedeva ZERO alternative
  // migliori: era codice morto. La prima linea del motore e' la mossa migliore in
  // assoluto, quindi e' sempre almeno pari a quanto ottenuto giocando — il conteggio
  // poteva valere zero solo quando lo scarto era gia' sotto la soglia minima.
  if (betterAlternatives <= 1 && before.lines.length >= 3) return quiet('onlyMove');
  if (betterAlternatives === 0) return quiet('onlyMove');

  // Un cambio di genere pesa piu' dello scarto nudo: passare da patta a persa e'
  // percepito (giustamente) come un errore grave anche con uno scarto piu' contenuto.
  const severity: Severity =
    drop >= options.blunder || base.crossing === 'winToLoss'
      ? 'blunder'
      : drop >= options.mistake || base.crossing !== null
        ? 'mistake'
        : 'inaccuracy';

  return { ...base, severity, skipped: null };
}

/** Vero per i verdetti che meritano di interrompere il gioco. */
export function isImportant(verdict: MistakeVerdict): boolean {
  return verdict.severity === 'mistake' || verdict.severity === 'blunder';
}
