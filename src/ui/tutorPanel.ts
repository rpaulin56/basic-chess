import type { MistakeVerdict } from '../tutor/detect.js';
import type { Consequence, LostPiece } from '../tutor/classify.js';
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

const CATEGORY_LABEL = {
  banale: 'catBanale',
  tattico: 'catTattico',
  strategico: 'catStrategico',
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

  const { verdict, consequence, bestSan, previewing } = state;
  const severity = verdict.severity as 'blunder' | 'mistake' | 'inaccuracy';
  container.className = `panel tutor tutor-${severity}`;

  // Titolo: la GRAVITA'. La categoria (banale/tattico/strategico) sta in
  // un'etichetta accanto, perche' e' una classificazione utile ma non e' la notizia.
  const heading = document.createElement('h2');
  heading.textContent = t(SEVERITY_LABEL[severity]);
  if (consequence) {
    const tag = document.createElement('span');
    tag.className = 'tutor-tag';
    tag.textContent = t(CATEGORY_LABEL[consequence.category]);
    heading.append(' ', tag);
  }
  container.append(heading);

  const lines: string[] = [];
  if (consequence) lines.push(describe(consequence));
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
  const named = consequence.lost.length > 0;
  const what = named ? nameLost(consequence.lost) : equivalent(consequence.materialLoss);
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
