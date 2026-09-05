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
  type GameState,
} from '../core/game.js';
import { parseGameInput } from '../core/import.js';
import { toPgn } from '../core/pgn.js';
import { createBoardView, type BoardView } from './boardView.js';
import { renderMoveList } from './moveList.js';
import { locale, setLocale, t, type LocaleCode } from '../i18n/index.js';

type Promotion = 'q' | 'r' | 'b' | 'n';

export function mountApp(root: HTMLElement): void {
  let state: GameState = newGame();
  let orientation: 'white' | 'black' = 'white';

  root.replaceChildren();
  const { boardWrap, statusEl, movesEl, controlsEl } = buildLayout(root);

  const board: BoardView = createBoardView(boardWrap, handleUserMove);

  function refresh(): void {
    board.render(state, orientation);
    renderMoveList(movesEl, state, (cursor) => {
      state = goTo(state, cursor);
      refresh();
    });
    renderStatus();
    renderControls();
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
    statusEl.textContent = positionAt(state).turn() === 'w' ? t('turnWhite') : t('turnBlack');
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
      button(t('takeBack'), t('takeBack'), state.cursor === 0, () => {
        state = truncateHere(goTo(state, state.cursor - 1));
        refresh();
      }),
      button(t('flipBoard'), t('flipBoard'), false, () => {
        orientation = orientation === 'white' ? 'black' : 'white';
        refresh();
      }),
      button(t('newGame'), t('newGame'), false, () => {
        state = newGame();
        refresh();
      }),
      button(t('importPosition'), t('importTitle'), false, importPosition),
      button(t('exportPgn'), t('exportPgn'), state.plies.length === 0, () => {
        void copy(toPgn(state));
      }),
      button(t('copyFen'), t('copyFen'), false, () => {
        void copy(currentFen(state));
      }),
      languageSelect(),
    );
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
      // Se la posizione importata ha il Nero al tratto, girare la scacchiera evita
      // all'utente di doverlo fare a mano ogni volta che carica un finale.
      orientation = state.startFen.split(' ')[1] === 'b' ? 'black' : 'white';
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
  const movesPanel = document.createElement('section');
  movesPanel.className = 'panel';
  const movesTitle = document.createElement('h2');
  movesTitle.textContent = t('moves');
  const movesEl = document.createElement('div');
  movesEl.className = 'movelist';
  movesPanel.append(movesTitle, movesEl);
  side.append(movesPanel);

  layout.append(boardColumn, side);
  root.append(header, layout);
  return { boardWrap, statusEl, movesEl, controlsEl };
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

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('copied'));
  } catch {
    // Alcuni browser negano la clipboard senza gesto diretto o fuori da HTTPS:
    // meglio mostrare il testo che perdere il PGN.
    prompt(t('copied'), text);
  }
}

function toast(message: string): void {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 1800);
}
