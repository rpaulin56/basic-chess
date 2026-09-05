import type { MistakeVerdict } from '../tutor/detect.js';
import { toFigurine } from '../core/notation.js';
import { t } from '../i18n/index.js';

/**
 * Il pannello del tutor.
 *
 * Regola di condotta decisa col committente: prima il MINIMO — che tipo di errore e'
 * e quanto e' costato — e la mossa migliore solo se richiesta esplicitamente. Dire
 * subito la soluzione toglie all'utente l'unica cosa che lo fa imparare, cioe' provare
 * a cercarla da solo.
 */

export interface TutorActions {
  onTakeBack(): void;
  onContinue(): void;
  onReveal(): void;
}

export interface TutorPanelState {
  readonly verdict: MistakeVerdict;
  /** SAN della mossa migliore, gia' calcolato dal chiamante (null = non ancora chiesto). */
  readonly bestSan: string | null;
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

export function renderTutorPanel(
  container: HTMLElement,
  state: TutorPanelState | null,
  actions: TutorActions,
): void {
  container.replaceChildren();
  if (!state) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const { verdict, bestSan } = state;
  const severity = verdict.severity;
  if (severity === 'none') return;

  container.className = `panel tutor tutor-${severity}`;

  const heading = document.createElement('h2');
  heading.textContent = t(SEVERITY_LABEL[severity]);
  container.append(heading);

  const lines: string[] = [t('tutorDrop', { drop: Math.round(verdict.drop) })];
  if (verdict.crossing) lines.push(t(CROSSING_LABEL[verdict.crossing]));
  // Quante alternative andavano bene e' un'informazione che orienta la ricerca: se
  // erano cinque, la mossa giusta non era nascosta e vale la pena ripensarci.
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
  buttons.append(
    action(t('tutorTakeBack'), actions.onTakeBack, 'primary'),
    action(t('tutorContinue'), actions.onContinue),
  );
  if (!bestSan) buttons.append(action(t('tutorShowBest'), actions.onReveal));
  container.append(buttons);
}

function action(label: string, onClick: () => void, className = ''): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', onClick);
  return button;
}
