import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { positionAt, legalDests, type GameState } from '../core/game.js';
import type { Arrow } from '../tutor/classify.js';

/**
 * Involucro sottile attorno a chessground.
 *
 * Volutamente NON conosce chess.js oltre a quanto gia' esposto da core/game: riceve
 * uno stato e lo disegna. Il tutor disegna le proprie frecce chiamando
 * `renderPosition`, senza che questo modulo debba sapere cosa significano.
 */

export type MoveHandler = (from: Key, to: Key) => void;

export interface BoardView {
  render(
    state: GameState,
    orientation: 'white' | 'black',
    humanColor: 'w' | 'b',
    /**
     * Vero se dalla posizione mostrata si puo' RIPARTIRE, anche quando la partita
     * continua piu' avanti.
     *
     * Oggi e' sempre vero, ed e' il senso della semplificazione: prima esistevano due
     * modi di tornare indietro — navigare (in sola lettura) e ritirare (giocabile) —
     * con un confine arbitrario fra loro. Ora la regola e' una sola: se nella
     * posizione che hai davanti tocca a te, puoi giocare. Il parametro resta perche'
     * il diagramma delle conseguenze passa comunque da `renderPosition`, e un domani
     * potrebbe servire una scacchiera davvero in sola lettura.
     */
    resumable?: boolean,
    /**
     * Il segno che la Nonna mette sulla mossa appena giocata quando interviene.
     *
     * Marca la mossa GIOCATA, non quella giusta: dire subito la risposta toglierebbe
     * l'unica cosa che fa imparare, cioe' cercarla. La freccia dice "guarda qui", non
     * "fai questa" — e su telefono e' l'unico modo di accorgersi che la Nonna ha
     * parlato, perche' il suo pannello sta sotto la piega.
     */
    mark?: { readonly from: Key; readonly to: Key; readonly brush: string },
  ): void;
  /**
   * Disegna una posizione qualunque, in sola lettura, con eventuali frecce. La usa il
   * tutor per mostrare le conseguenze di un errore: e' una posizione che nella partita
   * non esiste, quindi non puo' passare da `render`.
   */
  renderPosition(
    fen: string,
    orientation: 'white' | 'black',
    arrows: readonly Arrow[],
    lastMove?: readonly [Key, Key],
  ): void;
  destroy(): void;
}

export function createBoardView(container: HTMLElement, onMove: MoveHandler): BoardView {
  const api: Api = Chessground(container, {
    coordinates: true,
    animation: { enabled: true, duration: 180 },
    highlight: { lastMove: true, check: true },
    movable: { free: false, showDests: true },
    // Le PREMOSSE di chessground sono accese di default, e noi non le usiamo: quando
    // tocca alla Nonna si poteva prendere un proprio pezzo e vederne le case, come se
    // si potesse muovere. Non si puo', e la scacchiera non deve dire il contrario.
    premovable: { enabled: false },
    drawable: { enabled: true, visible: true },
    events: { move: (orig, dest) => onMove(orig, dest) },
  });

  return {
    render(state, orientation, humanColor, resumable = false, mark) {
      const chess = positionAt(state);
      const turn: 'white' | 'black' = chess.turn() === 'w' ? 'white' : 'black';
      const lastPly = state.cursor > 0 ? state.plies[state.cursor - 1] : undefined;
      // Muove solo l'umano e solo quando e' il suo turno — ma in QUALUNQUE posizione,
      // non solo nell'ultima: tornare indietro e giocare e' il modo con cui si ritira
      // una mossa, e vietarlo significherebbe rimettere in piedi la distinzione fra
      // navigare e ritirare che abbiamo appena tolto.
      // A partita finita nessuno muove: con exactOptionalPropertyTypes la chiave
      // `color` va OMESSA, non messa a undefined.
      const atEnd = state.cursor === state.plies.length || resumable;
      const humanTurn = atEnd && !chess.isGameOver() && chess.turn() === humanColor;
      const movable = humanTurn
        ? { free: false, color: turn, dests: legalDests(state) as Map<Key, Key[]>, showDests: true }
        : { free: false, dests: new Map<Key, Key[]>(), showDests: true };
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
      api.setShapes(mark ? [{ orig: mark.from, dest: mark.to, brush: mark.brush }] : []);
    },

    renderPosition(fen, orientation, arrows, lastMove) {
      api.set({
        fen,
        orientation,
        lastMove: lastMove ? [lastMove[0], lastMove[1]] : [],
        movable: { free: false, dests: new Map<Key, Key[]>(), showDests: false },
      });
      // Una freccia che parte e arriva sulla stessa casa diventa un cerchio: e' il
      // modo con cui il tutor segnala "questo pezzo sparisce".
      api.setShapes(
        arrows.map((arrow) =>
          arrow.orig === arrow.dest
            ? { orig: arrow.orig as Key, brush: arrow.brush }
            : { orig: arrow.orig as Key, dest: arrow.dest as Key, brush: arrow.brush },
        ),
      );
    },

    destroy() {
      api.destroy();
    },
  };
}
