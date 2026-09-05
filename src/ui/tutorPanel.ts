import type { MistakeVerdict } from '../tutor/detect.js';
import type { Consequence, LostPiece } from '../tutor/classify.js';
import type { Explanation } from '../tutor/positional.js';
import { toFigurine } from '../core/notation.js';
import { t } from '../i18n/index.js';

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
  /** SAN della mossa migliore, gia' calcolato dal chiamante (null = non ancora chiesto). */
  readonly bestSan: string | null;
  /**
   * Perche' la posizione peggiora, quando non c'e' materiale da mostrare. Vuoto se le
   * euristiche non hanno trovato niente da dire: e' un esito legittimo, e tacere e'
   * meglio che inventare.
   */
  readonly positional: readonly Explanation[];
  /** Vero mentre il diagramma delle conseguenze e' sulla scacchiera. */
  readonly previewing: boolean;
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

  const { verdict, consequence, bestSan, positional, previewing } = state;
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
  if (consequence) lines.push(describe(consequence));
  // Per l'errore strategico la frase generica ("la posizione peggiora") non insegna
  // nulla da sola: subito dopo vengono le ragioni misurate.
  if (consequence?.category === 'strategico') {
    for (const explanation of positional) lines.push(t(explanation.key, explanation.params));
    if (positional.length === 0) lines.push(t('posNothing'));
  }
  if (verdict.crossing) lines.push(t(CROSSING_LABEL[verdict.crossing]));
  lines.push(
    t('tutorWinChange', {
      before: Math.round(verdict.winPercentBefore),
      after: Math.round(verdict.winPercentAfter),
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

  if (bestSan) {
    const best = document.createElement('p');
    best.className = 'tutor-best';
    best.textContent = t('tutorBestWas', { move: toFigurine(bestSan) });
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
    if (consequence) buttons.append(action(t('tutorShowConsequence'), actions.onShowConsequence));
    if (!bestSan) buttons.append(action(t('tutorShowBest'), actions.onReveal));
  }
  container.append(buttons);
}

/** La frase che spiega la categoria. E' il testo che l'utente legge per primo. */
function describe(consequence: Consequence): string {
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

function action(label: string, onClick: () => void, className = ''): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', onClick);
  return button;
}
