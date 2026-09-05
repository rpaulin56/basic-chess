import type { Square } from 'chess.js';
import {
  currentFen,
  gameOver,
  goTo,
  hasFuture,
  newGame,
  playMove,
  positionAt,
  truncateHere,
  type Color,
  type GameState,
} from '../core/game.js';
import { parseGameInput } from '../core/import.js';
import { toPgn } from '../core/pgn.js';
import { BOT_LEVELS, levelById, selectBotMove, type BotLevel } from '../bot/bot.js';
import { formatScore } from '../engine/winProb.js';
import type { EngineLine } from '../engine/types.js';
import { createBoardView, type BoardView } from './boardView.js';
import { createEngineSession } from './engineSession.js';
import { renderMoveList } from './moveList.js';
import { locale, setLocale, t, type LocaleCode } from '../i18n/index.js';

type Promotion = 'q' | 'r' | 'b' | 'n';

/** Profondita' dell'analisi mostrata all'utente. Non e' la profondita' del bot: qui
 *  vogliamo la verita' sulla posizione, non una valutazione indebolita. */
const ANALYSIS_DEPTH = 14;

export function mountApp(root: HTMLElement): void {
  let state: GameState = newGame();
  let orientation: 'white' | 'black' = 'white';
  let humanColor: Color = 'w';
  let level: BotLevel = levelById(localStorage.getItem('basic-chess:level') ?? 'medio');

  /** Analisi della posizione attualmente mostrata (null = non ancora disponibile). */
  let evaluation: { line: EngineLine; depth: number; sideToMove: Color } | null = null;
  let botThinking = false;
  /**
   * Contatore di versione dello stato. Ogni analisi lo cattura prima di partire e lo
   * ricontrolla al ritorno: se nel frattempo l'utente ha mosso o navigato, il
   * risultato riguarda una posizione che non e' piu' quella mostrata e va buttato.
   * Senza questo, un'analisi lenta sovrascrive quella di una posizione successiva.
   */
  let generation = 0;

  root.replaceChildren();
  const { boardWrap, statusEl, movesEl, controlsEl, evalEl } = buildLayout(root);
  const board: BoardView = createBoardView(boardWrap, handleUserMove);
  const engine = createEngineSession(() => renderEnginePanel());

  function refresh(): void {
    generation++;
    board.render(state, orientation, humanColor);
    renderMoveList(movesEl, state, (cursor) => {
      state = goTo(state, cursor);
      evaluation = null;
      refresh();
    });
    renderStatus();
    renderControls();
    renderEnginePanel();
    void driveEngine();
  }

  // --- motore ------------------------------------------------------------

  /**
   * Decide cosa deve fare il motore per lo stato corrente: far muovere il bot se e'
   * il suo turno, altrimenti valutare la posizione mostrata.
   */
  async function driveEngine(): Promise<void> {
    if (engine.error()) return;
    const atEnd = state.cursor === state.plies.length;
    const chess = positionAt(state);
    if (chess.isGameOver()) return;

    const botTurn = atEnd && chess.turn() !== humanColor;
    if (botTurn) {
      if (botThinking) return;
      await playBotMove();
      return;
    }
    await updateEvaluation();
  }

  async function playBotMove(): Promise<void> {
    const mine = generation;
    botThinking = true;
    renderStatus();
    const fen = currentFen(state);
    const analysis = await engine.analyse(fen, { depth: level.depth, multiPV: level.multiPV });
    botThinking = false;
    // La posizione e' cambiata mentre il bot pensava (l'utente ha ritirato una mossa o
    // ha navigato indietro): la mossa calcolata non c'entra piu' nulla.
    if (mine !== generation || !analysis) {
      renderStatus();
      return;
    }
    const uci = selectBotMove(analysis, level);
    if (!uci) return;
    const next = playMove(
      state,
      uci.slice(0, 2) as Square,
      uci.slice(2, 4) as Square,
      (uci.slice(4) || undefined) as Promotion | undefined,
    );
    if (!next) return;
    state = next;
    evaluation = null;
    refresh();
  }

  async function updateEvaluation(): Promise<void> {
    const mine = generation;
    const fen = currentFen(state);
    const analysis = await engine.analyse(fen, { depth: ANALYSIS_DEPTH, multiPV: 1 });
    if (mine !== generation || !analysis || analysis.lines.length === 0) return;
    evaluation = {
      line: analysis.lines[0]!,
      depth: analysis.depth,
      sideToMove: fen.split(' ')[1] === 'b' ? 'b' : 'w',
    };
    renderEnginePanel();
  }

  // --- mosse -------------------------------------------------------------
  function handleUserMove(from: string, to: string): void {
    const origin = from as Square;
    const target = to as Square;

    // Giocare mentre si guarda una posizione passata cancella il seguito: si chiede
    // conferma qui, non dentro core/game (che resta puro).
    if (hasFuture(state)) {
      const discarded = state.plies.length - state.cursor;
      if (!confirm(t('overwriteFuture', { count: discarded }))) {
        refresh(); // rimette il pezzo dove stava
        return;
      }
      state = truncateHere(state);
    }

    if (needsPromotion(state, origin, target)) {
      askPromotion(boardWrap, (piece) => {
        if (piece) commit(origin, target, piece);
        else refresh();
      });
      return;
    }
    commit(origin, target);
  }

  function commit(from: Square, to: Square, promotion?: Promotion): void {
    const next = playMove(state, from, to, promotion);
    if (!next) {
      refresh(); // mossa illegale: annulla il movimento visivo
      return;
    }
    state = next;
    evaluation = null;
    refresh();
  }

  // --- pannelli ----------------------------------------------------------
  function renderStatus(): void {
    // Il verdetto finale si riferisce alla partita intera, non alla posizione che si
    // sta guardando: durante un rewind mostriamo di nuovo il tratto.
    const atEnd = state.cursor === state.plies.length;
    const over = atEnd ? gameOver(state) : null;
    if (over) {
      const winner = over.winner ? t(over.winner === 'w' ? 'white' : 'black') : '';
      statusEl.textContent = t(over.reason, { winner });
      statusEl.className = 'status over';
      return;
    }
    statusEl.className = 'status';
    if (botThinking) {
      statusEl.textContent = t('thinking');
      return;
    }
    statusEl.textContent = positionAt(state).turn() === 'w' ? t('turnWhite') : t('turnBlack');
  }

  function renderEnginePanel(): void {
    evalEl.replaceChildren();
    const failure = engine.error();
    if (failure) {
      evalEl.append(text(t('engineFailed', { error: failure }), 'eval-note'));
      return;
    }
    if (engine.loading()) {
      evalEl.append(text(t('engineLoading'), 'eval-note'));
      return;
    }
    if (!evaluation) {
      evalEl.append(text(t('analysing'), 'eval-note'));
      return;
    }
    const score = formatScore(evaluation.line, evaluation.sideToMove);
    evalEl.append(text(score, 'eval-score'), text(t('evalDepth', { depth: evaluation.depth }), 'eval-note'));
  }

  function renderControls(): void {
    controlsEl.replaceChildren();

    const nav = document.createElement('div');
    nav.className = 'nav';
    nav.append(
      button('⏮', t('first'), state.cursor === 0, () => seek(0)),
      button('◀', t('previous'), state.cursor === 0, () => seek(state.cursor - 1)),
      button('▶', t('next'), state.cursor >= state.plies.length, () => seek(state.cursor + 1)),
      button('⏭', t('last'), state.cursor >= state.plies.length, () => seek(state.plies.length)),
    );
    controlsEl.append(nav);

    controlsEl.append(
      button(t('takeBack'), t('takeBack'), state.cursor === 0, takeBack),
      button(t('flipBoard'), t('flipBoard'), false, () => {
        orientation = orientation === 'white' ? 'black' : 'white';
        refresh();
      }),
      button(t('newGame'), t('newGame'), false, () => {
        state = newGame();
        evaluation = null;
        refresh();
      }),
      button(t('importPosition'), t('importTitle'), false, importPosition),
      button(t('exportPgn'), t('exportPgn'), state.plies.length === 0, () => {
        void copy(toPgn(state));
      }),
      button(t('copyFen'), t('copyFen'), false, () => {
        void copy(currentFen(state));
      }),
      levelSelect(),
      colorSelect(),
      languageSelect(),
    );
  }

  /**
   * Ritira la mossa. Se il bot ha gia' risposto ne toglie DUE: ritirarne una sola
   * lascerebbe il turno all'avversario, che rigiocherebbe subito — l'utente si
   * ritroverebbe al punto di prima senza capire perche'.
   */
  function takeBack(): void {
    const chess = positionAt(goTo(state, state.plies.length));
    const back = chess.turn() === humanColor ? 2 : 1;
    state = truncateHere(goTo(state, Math.max(0, state.plies.length - back)));
    evaluation = null;
    refresh();
  }

  function levelSelect(): HTMLElement {
    const select = document.createElement('select');
    select.title = t('levelTitle');
    for (const option of BOT_LEVELS) {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = `${option.id} · ${option.nominalElo}`;
      element.selected = option.id === level.id;
      select.append(element);
    }
    select.addEventListener('change', () => {
      level = levelById(select.value);
      localStorage.setItem('basic-chess:level', level.id);
      refresh();
    });
    return select;
  }

  function colorSelect(): HTMLElement {
    const select = document.createElement('select');
    select.title = t('playAs');
    for (const color of ['w', 'b'] as const) {
      const element = document.createElement('option');
      element.value = color;
      element.textContent = t(color === 'w' ? 'white' : 'black');
      element.selected = color === humanColor;
      select.append(element);
    }
    select.addEventListener('change', () => {
      humanColor = select.value === 'b' ? 'b' : 'w';
      orientation = humanColor === 'w' ? 'white' : 'black';
      refresh();
    });
    return select;
  }

  function languageSelect(): HTMLElement {
    const select = document.createElement('select');
    select.title = t('language');
    for (const code of ['it', 'en'] as const) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code.toUpperCase();
      option.selected = locale() === code;
      select.append(option);
    }
    select.addEventListener('change', () => {
      setLocale(select.value as LocaleCode);
      refresh();
    });
    return select;
  }

  /**
   * Importa indifferentemente un FEN (una posizione: e' la forma in cui circolano le
   * raccolte di finali) o un PGN (una partita). Il riconoscimento lo fa core/import.
   */
  function importPosition(): void {
    const text = prompt(t('importPrompt'));
    if (!text) return;
    try {
      const imported = parseGameInput(text);
      state = imported.state;
      evaluation = null;
      // Chi importa un finale vuole quasi sempre giocarlo dal lato che deve muovere.
      humanColor = state.startFen.split(' ')[1] === 'b' ? 'b' : 'w';
      orientation = humanColor === 'b' ? 'black' : 'white';
      refresh();
      toast(
        imported.kind === 'fen'
          ? t('importedFen')
          : t('importedPgn', { count: state.plies.length }),
      );
    } catch (error) {
      alert(t('importInvalid', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  function seek(cursor: number): void {
    state = goTo(state, cursor);
    evaluation = null;
    refresh();
  }

  // Frecce della tastiera per scorrere la partita: piu' comodo dei pulsanti quando
  // si ripercorre una partita per capire dove si e' sbagliato.
  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === 'ArrowLeft') seek(state.cursor - 1);
    else if (event.key === 'ArrowRight') seek(state.cursor + 1);
    else if (event.key === 'Home') seek(0);
    else if (event.key === 'End') seek(state.plies.length);
    else return;
    event.preventDefault();
  });

  refresh();
}

// --- helper di costruzione ------------------------------------------------

function buildLayout(root: HTMLElement) {
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = t('appTitle');
  header.append(title);

  const layout = document.createElement('div');
  layout.className = 'layout';

  const boardColumn = document.createElement('div');
  boardColumn.className = 'board-column';
  const boardWrap = document.createElement('div');
  boardWrap.className = 'board-wrap';
  const statusEl = document.createElement('div');
  statusEl.className = 'status';
  const controlsEl = document.createElement('div');
  controlsEl.className = 'controls';
  boardColumn.append(boardWrap, statusEl, controlsEl);

  const side = document.createElement('aside');

  const evalPanel = document.createElement('section');
  evalPanel.className = 'panel';
  const evalTitle = document.createElement('h2');
  evalTitle.textContent = t('evaluation');
  const evalEl = document.createElement('div');
  evalEl.className = 'evaluation';
  evalPanel.append(evalTitle, evalEl);

  const movesPanel = document.createElement('section');
  movesPanel.className = 'panel';
  const movesTitle = document.createElement('h2');
  movesTitle.textContent = t('moves');
  const movesEl = document.createElement('div');
  movesEl.className = 'movelist';
  movesPanel.append(movesTitle, movesEl);

  side.append(evalPanel, movesPanel);
  layout.append(boardColumn, side);
  root.append(header, layout);
  return { boardWrap, statusEl, movesEl, controlsEl, evalEl };
}

function text(content: string, className: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = content;
  return element;
}

function button(label: string, title: string, disabled: boolean, onClick: () => void): HTMLElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.title = title;
  element.disabled = disabled;
  element.addEventListener('click', onClick);
  return element;
}

function needsPromotion(state: GameState, from: Square, to: Square): boolean {
  const piece = positionAt(state).get(from);
  if (!piece || piece.type !== 'p') return false;
  const rank = to[1];
  return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
}

const PROMOTION_GLYPHS: Record<Promotion, string> = {
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
};

function askPromotion(container: HTMLElement, done: (piece: Promotion | null) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'promotion';
  overlay.title = t('promotionTitle');
  const choices = document.createElement('div');
  choices.className = 'choices';
  for (const piece of ['q', 'r', 'b', 'n'] as const) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = PROMOTION_GLYPHS[piece];
    element.addEventListener('click', () => {
      overlay.remove();
      done(piece);
    });
    choices.append(element);
  }
  // Un click fuori dalle scelte annulla la mossa: meglio di intrappolare l'utente.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
      done(null);
    }
  });
  overlay.append(choices);
  container.append(overlay);
}

async function copy(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    toast(t('copied'));
  } catch {
    // Alcuni browser negano la clipboard senza gesto diretto o fuori da HTTPS:
    // meglio mostrare il testo che perdere il PGN.
    prompt(t('copied'), content);
  }
}

function toast(message: string): void {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 1800);
}
