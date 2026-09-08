import type { MistakeVerdict } from '../tutor/detect.js';
import type { Consequence, LostPiece } from '../tutor/classify.js';
import type { Explanation } from '../tutor/positional.js';
import { toFigurine } from '../core/notation.js';
import { locale, t } from '../i18n/index.js';

/**
 * Il pannello del tutor.
 *
 * Regola di condotta decisa col committente: prima il MINIMO — che tipo di errore e'
 * e cosa e' costato — e la soluzione (mossa migliore, diagramma delle conseguenze)
 * solo su richiesta. Dire subito la risposta toglie all'utente l'unica cosa che lo fa
 * imparare, cioe' provare a cercarla da solo.
 *
 * Sulla scelta delle parole: il tutor NOMINA cio' che si perde ("perdi il pedone
 * passato in c6") invece di quantificarlo ("perdi un pedone", peggio ancora "perdi
 * materiale"). Un principiante impara dal nome, non dal conteggio. Va anche detto che
 * in italiano "pezzo" esclude il pedone, quindi frasi come "il pezzo viene catturato"
 * riferite a un pedone sono proprio sbagliate.
 */

export interface TutorActions {
  onTakeBack(): void;
  onContinue(): void;
  onReveal(): void;
  onShowConsequence(): void;
  onClosePreview(): void;
}

export interface TutorPanelState {
  readonly verdict: MistakeVerdict;
  /** Che tipo di errore e' e cosa mostrare. null se non e' stato possibile stabilirlo. */
  readonly consequence: Consequence | null;
  /**
   * Le mosse che tenevano, in SAN, gia' tradotte dal chiamante. null finche' l'utente
   * non le chiede: mostrarle subito toglierebbe il senso di cercarle.
   */
  readonly betterSans: readonly string[] | null;
  /**
   * Perche' la posizione peggiora, quando non c'e' materiale da mostrare. Vuoto se le
   * euristiche non hanno trovato niente da dire: e' un esito legittimo, e tacere e'
   * meglio che inventare.
   */
  readonly positional: readonly Explanation[];
  /** Vero mentre il diagramma delle conseguenze e' sulla scacchiera. */
  readonly previewing: boolean;
  /**
   * Vero se la mossa precedente dell'avversario era essa stessa un errore
   * importante: allora questo non e' solo un tuo errore, e' un'occasione mancata.
   */
  readonly missedChance: boolean;
}

const SEVERITY_LABEL = {
  blunder: 'tutorBlunder',
  mistake: 'tutorMistake',
  inaccuracy: 'tutorInaccuracy',
} as const;

const CROSSING_LABEL = {
  winToLoss: 'crossWinToLoss',
  winToDraw: 'crossWinToDraw',
  drawToLoss: 'crossDrawToLoss',
} as const;

/**
 * Il titolo del pannello. Non e' "Errore" + categoria: "Errore svista" non si puo'
 * leggere. Ogni categoria ha il suo nome completo, e la gravita' diventa
 * un'etichetta accanto quando serve.
 */
const HEADING_LABEL = {
  banale: 'headBanale',
  tattico: 'headTattico',
  strategico: 'headStrategico',
} as const;

const PIECE_LABEL = {
  p: 'pieceP',
  n: 'pieceN',
  b: 'pieceB',
  r: 'pieceR',
  q: 'pieceQ',
} as const;

export function renderTutorPanel(
  container: HTMLElement,
  state: TutorPanelState | null,
  actions: TutorActions,
): void {
  container.replaceChildren();
  if (!state || state.verdict.severity === 'none') {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const { verdict, consequence, betterSans, positional, previewing, missedChance } = state;
  const severity = verdict.severity as 'blunder' | 'mistake' | 'inaccuracy';
  container.className = `panel tutor tutor-${severity}`;

  // Titolo: il nome della categoria ("Svista", "Errore tattico", "Errore
  // strategico"). Se la classificazione non e' riuscita si ripiega sulla gravita'.
  // L'etichetta accanto compare solo quando l'errore e' grave: dirlo sempre la
  // renderebbe rumore.
  const heading = document.createElement('h2');
  heading.textContent = consequence
    ? t(HEADING_LABEL[consequence.category])
    : t(SEVERITY_LABEL[severity]);
  if (consequence && severity === 'blunder') {
    const tag = document.createElement('span');
    tag.className = 'tutor-tag';
    tag.textContent = t('severeTag');
    heading.append(' ', tag);
  }
  container.append(heading);

  const lines: string[] = [];
  // Se l'avversario aveva appena sbagliato, la frase piu' utile viene PRIMA di tutto
  // il resto e cambia cosa si impara: non "hai sbagliato" ma "avevi un'occasione e
  // non l'hai vista". L'abitudine che manca a chi comincia e' proprio guardare la
  // mossa appena giocata dall'altro, e questa e' l'unica riga che gliela insegna.
  if (missedChance) lines.push(t('tutorMissedChance'));
  // Per l'errore strategico le ragioni misurate SOSTITUISCONO la frase generica,
  // non la seguono. "Non perdi materiale, ma la posizione peggiora" seguito da
  // "perdi il tuo pedone passato" si legge come una contraddizione: il saldo e' pari
  // (un pedone per un pedone) ma il pezzo che contava se n'e' andato, e la seconda
  // frase lo dice meglio da sola.
  if (consequence?.category === 'strategico' && positional.length > 0) {
    for (const explanation of positional) lines.push(t(explanation.key, explanation.params));
  } else if (consequence) {
    lines.push(describe(consequence));
    if (consequence.category === 'strategico') lines.push(t('posNothing'));
  }
  if (verdict.crossing) lines.push(t(CROSSING_LABEL[verdict.crossing]));
  lines.push(
    t('tutorWinChange', {
      before: Math.round(verdict.winPercentBefore),
      to: toPercent(Math.round(verdict.winPercentAfter)),
    }),
  );
  // Quante alternative andavano bene orienta la ricerca: se erano cinque, la mossa
  // giusta non era nascosta e vale la pena ripensarci.
  lines.push(
    verdict.betterAlternatives === 1
      ? t('tutorAlternativeOne')
      : t('tutorAlternatives', { count: verdict.betterAlternatives }),
  );

  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    container.append(paragraph);
  }

  if (betterSans && betterSans.length > 0) {
    const best = document.createElement('p');
    best.className = 'tutor-best';
    const figurine = betterSans.map(toFigurine);
    best.textContent =
      figurine.length === 1
        ? t('tutorBestWas', { move: figurine[0]! })
        : t('tutorBetterWere', { moves: figurine.join(', '), best: figurine[0]! });
    container.append(best);
  }

  const buttons = document.createElement('div');
  buttons.className = 'tutor-actions';
  if (previewing) {
    buttons.append(action(t('previewClose'), actions.onClosePreview, 'primary'));
  } else {
    buttons.append(
      action(t('tutorTakeBack'), actions.onTakeBack, 'primary'),
      action(t('tutorContinue'), actions.onContinue),
    );
    // "Se la tieni, ti faccio vedere" stava nel suggerimento di quel pulsante, cioe'
    // in nessun posto su telefono. Dice cosa succede DOPO aver scelto, ed e' proprio
    // l'informazione che serve prima di scegliere: adesso e' una riga di testo.
    const note = document.createElement('p');
    note.className = 'tutor-note';
    note.textContent = t('tutorContinueTitle');
    container.append(note);
    if (consequence) buttons.append(action(t('tutorShowConsequence'), actions.onShowConsequence));
    if (!betterSans) buttons.append(action(t('tutorShowBest'), actions.onReveal));
  }
  container.append(buttons);
}

/** La frase che spiega la categoria. E' il testo che l'utente legge per primo. */
function describe(consequence: Consequence): string {
  // Il matto viene prima di qualunque conto sul materiale: a chi viene mattato non
  // interessa quale pedone ha perso per strada.
  if (consequence.matesIn !== null) {
    return consequence.matesIn <= 1 ? t('mateNow') : t('mateIn', { moves: consequence.matesIn });
  }
  const moves = Math.ceil(consequence.manifestAt / 2);
  // "perdi la qualita'" e "perdi il pedone passato in c6" reggono la stessa frase;
  // solo il saldo nudo ("l'equivalente di due pedoni") ha bisogno di una forma sua.
  const named = consequence.lossKind !== 'count';
  const what =
    consequence.lossKind === 'named'
      ? nameLost(consequence.lost)
      : consequence.lossKind === 'exchange'
        ? t('lossExchange')
        : equivalent(consequence.materialLoss);
  switch (consequence.category) {
    case 'banale':
      return t(named ? 'catBanaleText' : 'catBanaleCount', { what });
    case 'tattico':
      return t(named ? 'catTatticoText' : 'catTatticoCount', { moves, what });
    case 'strategico':
      return t('catStrategicoText');
  }
}

/** "il pedone passato in c6", "la torre in a8 e il cavallo in f6". */
function nameLost(lost: readonly LostPiece[]): string {
  return lost
    .map((piece) =>
      t('pieceAt', {
        piece: t(piece.passed ? 'piecePassed' : PIECE_LABEL[piece.type]),
        square: piece.square,
      }),
    )
    .join(t('pieceAnd'));
}

/** Ripiego quando la perdita e' il saldo di uno scambio e non un pezzo identificabile. */
function equivalent(pawns: number): string {
  return pawns === 1 ? t('equivalentOne') : t('equivalentMany', { count: pawns });
}

function action(label: string, onClick: () => void, className = '', title = ''): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  if (title) button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

/**
 * "al 64%", "allo 0%", "all'8%".
 *
 * In italiano l'articolo davanti a un numero dipende da come il numero si PRONUNCIA:
 * "lo zero", "l'uno", "l'otto", "l'undici", "l'ottanta". Scrivere sempre "al" produce
 * "al 0%", che nessuno direbbe. In inglese il problema non esiste e si usa "to".
 */
function toPercent(value: number): string {
  if (locale() !== 'it') return `to ${value}%`;
  if (value === 0) return `allo ${value}%`;
  const vowelStart = [1, 8, 11, 18].includes(value) || (value >= 80 && value <= 89);
  return vowelStart ? `all’${value}%` : `al ${value}%`;
}
