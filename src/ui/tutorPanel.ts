import { kindOf, type MistakeVerdict } from '../tutor/detect.js';
import type { Consequence } from '../tutor/classify.js';
import { t } from '../i18n/index.js';
import { toFigurine } from '../core/notation.js';
import type { MaterialFact } from '../tutor/materialFact.js';

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
   * Il fatto sul materiale, se ce n'e' uno CERTO: la cattura che l'avversaria fa subito,
   * o quella che c'era e non si e' fatta. Tutto il resto non si dice con precisione.
   */
  readonly fact: MaterialFact | null;
  /** Vero mentre il diagramma delle conseguenze e' sulla scacchiera. */
  readonly previewing: boolean;
  /**
   * Vero se le mosse buone erano piu' di quelle disegnate: le frecce sono al massimo
   * cinque, e le altre, equivalenti, vanno almeno nominate.
   */
  readonly moreGood?: boolean;
  /**
   * Vero se la mossa precedente dell'avversario era essa stessa un errore
   * importante: allora questo non e' solo un tuo errore, e' un'occasione mancata.
   */
  readonly missedChance: boolean;
  /** Come e' girata la scacchiera: le barrette si orientano come la barra grande. */
  readonly orientation: 'white' | 'black';
  /** Il colore di chi gioca, perche' l'aspettativa del verdetto e' la SUA. */
  readonly humanColor: 'w' | 'b';
  /**
   * Quanto la Nonna e' ancora disposta a perdonare (vedi FORGIVE_LIMIT in app.ts):
   * 'last' e' l'ultimo perdono, 'exhausted' vuol dire che la mossa resta.
   */
  readonly forgiveness: 'available' | 'last' | 'exhausted';
  /** Il limite di mosse cambiate della partita (vedi TAKEBACK_LIMITS); null e' senza limite. */
  readonly forgiveLimit: number | null;
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

/** Quando la mossa non cambia fascia: eri li', e ci resti peggio. */
const STAY_LABEL = {
  win: 'stayWin',
  draw: 'stayDraw',
  loss: 'stayLoss',
} as const;

/**
 * Il titolo del pannello. Non e' "Errore" + categoria: "Errore svista" non si puo'
 * leggere. Ogni categoria ha il suo nome completo, e la gravita' diventa
 * un'etichetta accanto quando serve.
 */
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

  const { verdict, consequence, betterSans, previewing, missedChance } = state;
  const severity = verdict.severity as 'blunder' | 'mistake' | 'inaccuracy';
  container.className = `panel tutor tutor-${severity}`;

  // Titolo: "Svista" quando un pezzo resta in presa per certo, altrimenti la gravita'
  // misurata dal motore. "Errore tattico" ed "Errore strategico" venivano dalla coda della
  // variante, come le frasi sotto, e con la stessa incertezza (settembre 2026). L'etichetta
  // accanto compare solo quando l'errore e' grave: dirlo sempre la renderebbe rumore.
  const heading = document.createElement('h2');
  const blunderByFact = state.fact?.kind === 'lost';
  heading.textContent = blunderByFact ? t('headBanale') : t(SEVERITY_LABEL[severity]);
  if (blunderByFact && severity === 'blunder') {
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
  //
  // Dal settembre 2026 si dice con precisione solo cio' che e' CERTO (piano "dire meno,
  // mostrare meglio"): il matto, che il motore annuncia senza incertezza, e il fatto sul
  // materiale che si vede con una cattura. Le frasi di prima ("tra tre mosse perdi
  // l'Alfiere", "alla fine dello scambio ti trovi con un Cavallo in meno") venivano dalla
  // coda di una variante, e rianalizzando partite vere cambiavano con la profondita'.
  // Quello che non e' certo si mostra con "Mostra le conseguenze", non si racconta.
  if (consequence && consequence.matesIn !== null) {
    lines.push(consequence.matesIn <= 1 ? t('mateNow') : t('mateIn', { moves: consequence.matesIn }));
  } else if (state.fact) {
    const what = t(MISSED_LABEL[state.fact.piece]);
    const move = toFigurine(state.fact.move);
    lines.push(t(state.fact.kind === 'lost' ? 'factLost' : 'factMissed', { what, move }));
  } else {
    lines.push(t('factWorse'));
  }
  // Dove eri e dove finisci, detto a parole e SEMPRE: una sola frase fra sei.
  //
  // Prima c'erano due righe — il passaggio di fascia quando c'era, e sempre
  // "l'aspettativa di vittoria scende dall'80% al 63%" — e la seconda era tecnica e
  // macchinosa, oltre a costare in italiano un codice apposta per scegliere fra "al",
  // "allo" e "all'". Il numero non e' sparito: sta nelle barrette qui accanto, che sono
  // la barra grande in piccolo. La gravita' non si ripete: la dice gia' il titolo.
  lines.push(
    t(verdict.crossing ? CROSSING_LABEL[verdict.crossing] : STAY_LABEL[kindOf(verdict.winPercentBefore)]),
  );
  // Quante alternative andavano bene orienta la ricerca: se erano cinque, la mossa
  // giusta non era nascosta e vale la pena ripensarci.
  lines.push(
    verdict.betterAlternatives === 1
      ? t('tutorAlternativeOne')
      : t('tutorAlternatives', { count: verdict.betterAlternatives }),
  );
  // Il perdono ha un limite, e la Nonna lo dice: prima che finisca, e quando e' finito.
  // Un pulsante spento senza una frase che spieghi perche' sembrerebbe un guasto.
  if (state.forgiveness === 'last') lines.push(t('tutorForgiveLast'));
  if (state.forgiveness === 'exhausted') {
    lines.push(
      state.forgiveLimit === 0
        ? t('tutorForgiveNone')
        : state.forgiveLimit === 1
          ? t('tutorForgiveNoMoreOne')
          : t('tutorForgiveNoMore', { count: state.forgiveLimit ?? 0 }),
    );
  }

  const body = document.createElement('div');
  body.className = 'tutor-body';
  const text = document.createElement('div');
  text.className = 'tutor-text';
  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    text.append(paragraph);
  }
  body.append(text, expectancyBars(verdict, state.orientation, state.humanColor));
  container.append(body);

  // "La mossa migliore era..." non si scrive piu': le mosse buone si vedono sulla
  // scacchiera, verdi, accanto alla rossa di quella giocata (vedi `bestView` in app.ts).
  if (state.previewing && state.moreGood) {
    const more = document.createElement('p');
    more.className = 'tutor-best';
    more.textContent = t('tutorMoreGood');
    container.append(more);
  }

  const buttons = document.createElement('div');
  buttons.className = 'tutor-actions';
  if (previewing) {
    buttons.append(action(t('previewClose'), actions.onClosePreview, 'primary'));
  } else {
    // Prima capire, poi decidere: nell'ordine in cui si usano, e colorato solo "Mostra
    // conseguenze". Era colorato "Annulla", quando il tutor serviva soprattutto a far
    // rifare la mossa; con il perdono che si esaurisce, spingere verso quello non ha piu'
    // senso, e spingere verso "Continua" farebbe premere senza leggere. La cosa da fare
    // adesso e' capire l'errore; le due decisioni restano alla pari.
    if (consequence) buttons.append(action(t('tutorShowConsequence'), actions.onShowConsequence, 'primary'));
    if (!betterSans) buttons.append(action(t('tutorShowBest'), actions.onReveal));
    const change = action(t('tutorTakeBack'), actions.onTakeBack) as HTMLButtonElement;
    change.disabled = state.forgiveness === 'exhausted';
    buttons.append(change, action(t('tutorContinue'), actions.onContinue));
  }
  container.append(buttons);
}

/** Il pezzo che manca alla fine dello scambio, con l'articolo indeterminativo. */
const MISSED_LABEL = {
  p: 'missedP',
  n: 'missedN',
  b: 'missedB',
  r: 'missedR',
  q: 'missedQ',
} as const;

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
 * L'aspettativa prima e dopo la mossa, come due barre grandi in piccolo.
 *
 * Orientate come la barra accanto alla scacchiera — il pieno in basso e' il colore che
 * sta in basso — perche' chi ha imparato a leggere quella legga queste senza pensarci.
 * Proposta dell'autore, e l'orientamento e' la parte su cui e' stato piu' netto.
 *
 * Il numero esatto resta nel suggerimento: chi lo cerca lo trova, chi gioca non deve
 * leggerlo.
 */
function expectancyBars(
  verdict: MistakeVerdict,
  orientation: 'white' | 'black',
  humanColor: 'w' | 'b',
): HTMLElement {
  const before = Math.round(verdict.winPercentBefore);
  const after = Math.round(verdict.winPercentAfter);
  const wrap = document.createElement('div');
  wrap.className = 'tutor-bars';
  const label = t('tutorBarsTitle', { before, after });
  wrap.title = label;
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', label);
  // Il verdetto parla per chi ha mosso; la barra per il colore che sta IN BASSO.
  const mineAtBottom = (orientation === 'white') === (humanColor === 'w');
  const bar = (percent: number): HTMLElement => {
    const element = document.createElement('div');
    element.className = `eval-bar mini ${orientation === 'white' ? 'light' : 'dark'}`;
    const fill = document.createElement('div');
    fill.className = 'eval-fill';
    fill.style.height = `${mineAtBottom ? percent : 100 - percent}%`;
    element.append(fill);
    return element;
  };
  const arrow = document.createElement('span');
  arrow.className = 'tutor-bars-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  wrap.append(bar(before), arrow, bar(after));
  return wrap;
}
