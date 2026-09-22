import { Chess } from 'chess.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key, Role } from 'chessground/types';
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

export interface Ghost {
  readonly square: Key;
  readonly role: Role;
  readonly color: 'white' | 'black';
}

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
    /**
     * Le frecce della modalita' "studia aperture": le mosse che si giocano davvero in
     * questa posizione, con lo spessore dato da quanto sono giocate.
     *
     * Stanno insieme al segno del tutor e non al suo posto: sono due cose diverse, e
     * capita che ci siano entrambe (il tutor parla, e la posizione e' ancora in teoria).
     */
    study?: readonly { readonly from: Key; readonly to: Key; readonly brush: string }[],
    /**
     * Le mosse che si possono giocare AL POSTO dell'avversaria, in modalita' studio.
     *
     * Sono le stesse delle frecce: tocchi il pezzo e vedi i pallini solo sulle case di
     * teoria. Serve a farle cambiare risposta per studiarla, quindi non e' una liberta'
     * di muovere i suoi pezzi: fuori dalle frecce non si va.
     */
    studyDests?: Map<Key, Key[]>,
    /**
     * I pezzi FANTASMA della fotografia del matto: dove andranno i pezzi che lo danno.
     * Un pezzo e non una freccia sola, perche' una freccia dritta si leggerebbe come
     * "gioca questa mossa", e spesso quella mossa non esiste (un cavallo, un giro largo).
     */
    ghosts?: readonly Ghost[],
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
    /** Le mosse che si possono fare, per chi ha il tratto: solo per le ipotesi da esplorare. */
    dests?: Map<Key, Key[]>,
  ): void;
  destroy(): void;
}

export function createBoardView(container: HTMLElement, onMove: MoveHandler): BoardView {
  /**
   * Le frecce messe dal PROGRAMMA (il segno del tutor, la teoria), tenute da parte.
   *
   * Chessground le tratta come i disegni fatti col tasto destro, e li cancella al primo
   * clic sulla scacchiera: toccando un pezzo sparivano tutte. Qui le conserviamo e le
   * rimettiamo quando lui le azzera — ma solo allora, cosi' chi disegna con il tasto
   * destro resta libero di farlo.
   */
  let programShapes: DrawShape[] = [];

  const api: Api = Chessground(container, {
    coordinates: true,
    animation: { enabled: true, duration: 180 },
    highlight: { lastMove: true, check: true },
    movable: { free: false, showDests: true },
    // Le PREMOSSE di chessground sono accese di default, e noi non le usiamo: quando
    // tocca alla Nonna si poteva prendere un proprio pezzo e vederne le case, come se
    // si potesse muovere. Non si puo', e la scacchiera non deve dire il contrario.
    premovable: { enabled: false },
    drawable: {
      enabled: true,
      visible: true,
      onChange: (shapes) => {
        if (shapes.length === 0 && programShapes.length > 0) api.setShapes([...programShapes]);
      },
      // I pennelli del libro: stesso colore, spessore crescente. Lo spessore dice quanto
      // una mossa e' giocata — un numero accanto a ogni freccia sarebbe rumore, e la
      // proporzione si legge a colpo d'occhio senza leggere niente.
      brushes: {
        // I quattro standard vanno ridichiarati con i LORO valori: chessground li pretende
        // tutti, e sono quelli che usano il tutor (rosso e giallo) e le conseguenze.
        green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
        red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
        blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
        yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
        book1: { key: 'bk1', color: '#3692e7', opacity: 0.45, lineWidth: 4 },
        book2: { key: 'bk2', color: '#3692e7', opacity: 0.55, lineWidth: 7 },
        book3: { key: 'bk3', color: '#3692e7', opacity: 0.65, lineWidth: 11 },
        book4: { key: 'bk4', color: '#3692e7', opacity: 0.75, lineWidth: 15 },
        // La fotografia del matto: un colore che non si confonde con le mosse (verdi) ne'
        // con la teoria (azzurre). Una freccia sola per tutti, re nemico compreso.
        mate: { key: 'mt', color: '#7b3fb5', opacity: 0.8, lineWidth: 10 },
      },
    },
    events: { move: (orig, dest) => onMove(orig, dest) },
  });

  /*
   * Una misura della scacchiera che non si fida dello zero.
   *
   * Chessground misura la scacchiera una volta e ricorda il risultato finche' non cambia
   * dimensione. Se la misura capita mentre la pagina si sta ridisegnando, la scacchiera
   * puo' risultare alta zero, e da li' ogni freccia esce schiacciata o con coordinate NaN,
   * cioe' invisibile (trovato sulla fotografia del matto). I pezzi non ne soffrono perche'
   * stanno in percentuale. Qui una misura nulla non si ricorda: si rimisura la volta dopo.
   */
  let keepBounds = (): void => {};
  {
    let cached: DOMRectReadOnly | undefined;
    const bounds = (): DOMRectReadOnly => {
      if (!cached || cached.width === 0 || cached.height === 0) {
        cached = api.state.dom.elements.board.getBoundingClientRect();
      }
      return cached;
    };
    bounds.clear = (): void => {
      cached = undefined;
    };
    // Rimessa dopo ogni `set`: girando la scacchiera chessground ricostruisce il suo stato
    // e tornerebbe alla misura di serie.
    keepBounds = () => {
      if (api.state.dom.bounds !== bounds) api.state.dom.bounds = bounds;
    };
    keepBounds();
    // Chessground al cambio di dimensione riposiziona i pezzi ma non le frecce: senza,
    // ruotando il telefono restavano disegnate con la misura di prima.
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        bounds.clear();
        api.state.dom.redraw();
      }).observe(container);
    }
  }

  return {
    render(state, orientation, humanColor, resumable = false, mark, study = [], studyDests, ghosts = []) {
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
      const studyTurn = !humanTurn && !chess.isGameOver() && (studyDests?.size ?? 0) > 0;
      const movable = humanTurn
        ? { free: false, color: turn, dests: legalDests(state) as Map<Key, Key[]>, showDests: true }
        : studyTurn
          ? { free: false, color: turn, dests: studyDests as Map<Key, Key[]>, showDests: true }
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
      keepBounds();
      programShapes = [
        ...study.map((arrow) => ({ orig: arrow.from, dest: arrow.to, brush: arrow.brush })),
        ...(mark ? [{ orig: mark.from, dest: mark.to, brush: mark.brush }] : []),
      ];
      api.setShapes([...programShapes]);
      // I fantasmi passano dalle forme AUTOMATICHE: chessground disegna i pezzi solo li'
      // (le altre forme ignorano `piece`), e un clic sulla scacchiera non le cancella.
      api.setAutoShapes(ghosts.map((ghost) => ({ orig: ghost.square, piece: { role: ghost.role, color: ghost.color } })));
    },

    renderPosition(fen, orientation, arrows, lastMove, dests) {
      // Lo scacco va detto ogni volta, come fa `render`: chessground lo ricorda finche'
      // non glielo si cambia, e la posizione finale — Re sotto scacco — lasciava il suo
      // disco rosso su tutte le posizioni passate aperte dal racconto (segnalato con due
      // screenshot: "il famigerato disco rosso").
      let check = false;
      let turnColor: 'white' | 'black' = 'white';
      try {
        const chess = new Chess(fen);
        check = chess.inCheck();
        turnColor = chess.turn() === 'w' ? 'white' : 'black';
      } catch {
        // Posizione illeggibile: niente scacco da mostrare.
      }
      api.set({
        fen,
        orientation,
        turnColor,
        check,
        lastMove: lastMove ? [lastMove[0], lastMove[1]] : [],
        movable: dests
          ? { free: false, color: turnColor, dests, showDests: true }
          : { free: false, dests: new Map<Key, Key[]>(), showDests: false },
      });
      keepBounds();
      api.setAutoShapes([]);
      // Una freccia che parte e arriva sulla stessa casa diventa un cerchio: e' il
      // modo con cui il tutor segnala "questo pezzo sparisce".
      api.setShapes(
        arrows.map((arrow) =>
          arrow.orig === arrow.dest
            ? { orig: arrow.orig as Key, brush: arrow.brush }
            : { orig: arrow.orig as Key, dest: arrow.dest as Key, brush: arrow.brush },
        ),
      );
      // Chessground tiene le forme nel suo stato ma non sempre le disegna: con la misura
      // memorizzata da `keepBounds` il suo ridisegno non parte, e le frecce restavano
      // invisibili anche se c'erano. Un ridisegno esplicito costa poco: questa strada si
      // percorre quando si guarda una posizione, non a ogni mossa.
      api.redrawAll();
    },

    destroy() {
      api.destroy();
    },
  };
}
