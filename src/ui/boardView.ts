import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { positionAt, legalDests, type GameState } from '../core/game.js';

/**
 * Involucro sottile attorno a chessground.
 *
 * Volutamente NON conosce chess.js oltre a quanto gia' esposto da core/game: riceve
 * uno stato e lo disegna. Il tutor (fase 4) disegnera' le proprie frecce chiamando
 * `setArrows`, senza che questo modulo debba sapere cosa significano.
 */

export type MoveHandler = (from: Key, to: Key) => void;

export interface BoardView {
  render(state: GameState, orientation: 'white' | 'black'): void;
  setArrows(arrows: readonly { orig: Key; dest: Key; brush: string }[]): void;
  destroy(): void;
}

export function createBoardView(container: HTMLElement, onMove: MoveHandler): BoardView {
  const api: Api = Chessground(container, {
    coordinates: true,
    animation: { enabled: true, duration: 180 },
    highlight: { lastMove: true, check: true },
    movable: { free: false, showDests: true },
    drawable: { enabled: true, visible: true },
    events: { move: (orig, dest) => onMove(orig, dest) },
  });

  return {
    render(state, orientation) {
      const chess = positionAt(state);
      const turn: 'white' | 'black' = chess.turn() === 'w' ? 'white' : 'black';
      const lastPly = state.cursor > 0 ? state.plies[state.cursor - 1] : undefined;
      // Muove solo chi ha il tratto; in fase 2 diventera' "solo il colore dell'umano",
      // quando dall'altra parte ci sara' il bot. A partita finita nessuno muove:
      // con exactOptionalPropertyTypes la chiave va OMESSA, non messa a undefined.
      const movable = chess.isGameOver()
        ? { free: false, dests: new Map<Key, Key[]>(), showDests: true }
        : { free: false, color: turn, dests: legalDests(state) as Map<Key, Key[]>, showDests: true };
      api.set({
        fen: chess.fen(),
        orientation,
        turnColor: turn,
        check: chess.inCheck(),
        // Array vuoto (non undefined) per CANCELLARE l'evidenziazione: chessground
        // tipizza lastMove come Key[], e undefined non lo azzererebbe comunque.
        lastMove: lastPly ? [lastPly.from as Key, lastPly.to as Key] : [],
        movable,
      });
    },
    setArrows(arrows) {
      api.setShapes(arrows.map((a) => ({ orig: a.orig, dest: a.dest, brush: a.brush })));
    },
    destroy() {
      api.destroy();
    },
  };
}
