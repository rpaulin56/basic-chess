import { Chess, type Square, type Move } from 'chess.js';

/**
 * Stato della partita come LISTA IMMUTABILE di semi-mosse.
 *
 * Scelta di fondo: non teniamo un oggetto Chess mutabile come fonte di verita'.
 * Teniamo la sequenza delle mosse gia' giocate piu' un cursore; la posizione
 * "corrente" si ricostruisce rigiocando le mosse fino al cursore. Cosi' il rewind
 * e' semplicemente "sposta il cursore" invece di essere una macchina a stati da
 * mantenere coerente, e ogni posizione della partita resta raggiungibile e
 * analizzabile in qualunque momento (cosa di cui il tutor avra' bisogno).
 */

export type Color = 'w' | 'b';

/** Una semi-mossa gia' giocata, con tutto il contesto che servira' al tutor. */
export interface Ply {
  /** Notazione algebrica standard, es. "Nf3", "exd5", "O-O". */
  readonly san: string;
  readonly from: Square;
  readonly to: Square;
  /** Pezzo di promozione, se la mossa era una promozione. */
  readonly promotion?: 'q' | 'r' | 'b' | 'n';
  /** Chi ha mosso. */
  readonly color: Color;
  /** FEN PRIMA della mossa: e' la posizione in cui il giocatore ha deciso. */
  readonly fenBefore: string;
  /** FEN DOPO la mossa. */
  readonly fenAfter: string;
}

export interface GameState {
  /** Posizione di partenza (FEN). Non e' detto sia quella iniziale: si puo' partire da un PGN. */
  readonly startFen: string;
  readonly plies: readonly Ply[];
  /** Quante semi-mosse sono "visibili": 0 = posizione di partenza, plies.length = fine partita. */
  readonly cursor: number;
}

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function newGame(startFen: string = INITIAL_FEN): GameState {
  // Validazione: se il FEN e' illegale, new Chess() lancia. Meglio saperlo subito.
  new Chess(startFen);
  return { startFen, plies: [], cursor: 0 };
}

/** Ricostruisce una posizione giocabile fino a `upTo` semi-mosse (default: il cursore). */
export function positionAt(state: GameState, upTo: number = state.cursor): Chess {
  const chess = new Chess(state.startFen);
  for (let i = 0; i < upTo; i++) {
    const ply = state.plies[i]!;
    chess.move({ from: ply.from, to: ply.to, ...(ply.promotion ? { promotion: ply.promotion } : {}) });
  }
  return chess;
}

export function currentFen(state: GameState): string {
  return state.cursor === 0 ? state.startFen : state.plies[state.cursor - 1]!.fenAfter;
}

export function turnAt(state: GameState): Color {
  return currentFen(state).split(' ')[1] === 'b' ? 'b' : 'w';
}

/** Mosse legali dalla posizione corrente, raggruppate per casa di partenza (formato chessground). */
export function legalDests(state: GameState): Map<Square, Square[]> {
  const chess = positionAt(state);
  const dests = new Map<Square, Square[]>();
  for (const move of chess.moves({ verbose: true }) as Move[]) {
    const list = dests.get(move.from);
    if (list) list.push(move.to);
    else dests.set(move.from, [move.to]);
  }
  return dests;
}

/**
 * Gioca una mossa dalla posizione corrente.
 *
 * Se il cursore non e' a fine partita (stiamo guardando una posizione passata),
 * giocare TRONCA il seguito: e' il comportamento voluto per un take-back, ed e'
 * responsabilita' della UI chiedere conferma prima di chiamare questa funzione.
 * Restituisce null se la mossa e' illegale, invece di lanciare: una mossa illegale
 * arriva dall'interfaccia, non e' un errore di programmazione.
 */
export function playMove(
  state: GameState,
  from: Square,
  to: Square,
  promotion?: 'q' | 'r' | 'b' | 'n',
): GameState | null {
  const chess = positionAt(state);
  const fenBefore = chess.fen();
  let move: Move;
  try {
    move = chess.move({ from, to, ...(promotion ? { promotion } : {}) });
  } catch {
    return null;
  }
  const ply: Ply = {
    san: move.san,
    from: move.from,
    to: move.to,
    ...(move.promotion ? { promotion: move.promotion as 'q' | 'r' | 'b' | 'n' } : {}),
    color: move.color,
    fenBefore,
    fenAfter: chess.fen(),
  };
  const plies = [...state.plies.slice(0, state.cursor), ply];
  return { ...state, plies, cursor: plies.length };
}

/** Sposta il cursore (senza toccare le mosse). Valori fuori range vengono limitati. */
export function goTo(state: GameState, cursor: number): GameState {
  const clamped = Math.max(0, Math.min(state.plies.length, cursor));
  return clamped === state.cursor ? state : { ...state, cursor: clamped };
}

/** Elimina definitivamente le mosse dopo il cursore (usato dal take-back). */
export function truncateHere(state: GameState): GameState {
  if (state.cursor === state.plies.length) return state;
  return { ...state, plies: state.plies.slice(0, state.cursor) };
}

/** Vero se ci sono mosse oltre il cursore che una nuova mossa cancellerebbe. */
export function hasFuture(state: GameState): boolean {
  return state.cursor < state.plies.length;
}

export interface GameOver {
  readonly reason: 'checkmate' | 'stalemate' | 'insufficient' | 'threefold' | 'fiftyMoves';
  /** Chi ha vinto; null in caso di patta. */
  readonly winner: Color | null;
}

export function gameOver(state: GameState): GameOver | null {
  const chess = positionAt(state);
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) return { reason: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' };
  if (chess.isStalemate()) return { reason: 'stalemate', winner: null };
  if (chess.isInsufficientMaterial()) return { reason: 'insufficient', winner: null };
  if (chess.isThreefoldRepetition()) return { reason: 'threefold', winner: null };
  return { reason: 'fiftyMoves', winner: null };
}

/** Numero di mossa (non semi-mossa) a cui appartiene la semi-mossa di indice `index`. */
export function moveNumberOf(state: GameState, index: number): number {
  const startFullmove = Number(state.startFen.split(' ')[5] ?? '1');
  const startsBlack = state.startFen.split(' ')[1] === 'b';
  return startFullmove + Math.floor((index + (startsBlack ? 1 : 0)) / 2);
}
