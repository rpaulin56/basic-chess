import type { MistakeVerdict } from '../tutor/detect.js';
import type { Consequence } from '../tutor/classify.js';
import { toFigurine } from '../core/notation.js';
import { t } from '../i18n/index.js';

/**
 * Il pannello del tutor.
 *
 * Regola di condotta decisa col committente: prima il MINIMO — che tipo di errore e'
 * e quanto e' costato — e la soluzione (mossa migliore, diagramma delle conseguenze)
 * solo su richiesta. Dire subito la risposta toglie all'utente l'unica cosa che lo fa
 * imparare, cioe' provare a cercarla da solo.
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

  const heading = document.createElement('h2');
  // Il titolo dice PRIMA che tipo di errore e' (banale/tattico/strategico) e poi
  // quanto e' grave: e' la parte che insegna qualcosa, la gravita' e' solo un'etichetta.
  heading.textContent = consequence
    ? `${t(CATEGORY_LABEL[consequence.category])} · ${t(SEVERITY_LABEL[severity])}`
    : t(SEVERITY_LABEL[severity]);
  container.append(heading);

  const lines: string[] = [];
  if (consequence) lines.push(describe(consequence));
  if (verdict.crossing) lines.push(t(CROSSING_LABEL[verdict.crossing]));
  lines.push(t('tutorDrop', { drop: Math.round(verdict.drop) }));
  // Quante alternative andavano bene orienta la ricerca: se erano cinque, la mossa
  // giusta non era nascosta e vale la pena ripensarci.
  lines.push(t('tutorAlternatives', { count: verdict.betterAlternatives }));

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
  switch (consequence.category) {
    case 'banale':
      return t('catBanaleText', { loss: formatLoss(consequence.materialLoss) });
    case 'tattico':
      return t('catTatticoText', { moves, loss: formatLoss(consequence.materialLoss) });
    case 'strategico':
      return t('catStrategicoText');
  }
}

function formatLoss(pawns: number): string {
  return pawns === 1 ? t('lossPawn') : t('lossPawns', { count: pawns });
}

function action(label: string, onClick: () => void, className = ''): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', onClick);
  return button;
}
