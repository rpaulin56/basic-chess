/**
 * Tipi dell'analisi, deliberatamente indipendenti da Stockfish e da UCI.
 *
 * Il tutor (fase 3-4) ragionera' SOLO su questi tipi: se un giorno sotto ci finisse
 * un altro motore (Maia via lc0, per dire), niente sopra questo livello cambia.
 */

/** Una linea di gioco valutata dal motore. */
export interface EngineLine {
  /** 1 = migliore, 2 = seconda scelta, ... (MultiPV). */
  readonly multipv: number;
  /**
   * Valutazione in centipawn DAL PUNTO DI VISTA DI CHI HA IL TRATTO.
   * null se la linea porta a un matto forzato: in quel caso guarda mateIn.
   */
  readonly scoreCp: number | null;
  /**
   * Matto in N mosse dal punto di vista di chi ha il tratto: positivo = matto a
   * favore, negativo = matto subito. null se non c'e' matto forzato.
   */
  readonly mateIn: number | null;
  /** Seguito previsto, in notazione UCI (es. "e2e4"). Il primo elemento e' la mossa. */
  readonly pv: readonly string[];
}

export interface Analysis {
  readonly fen: string;
  /** Profondita' effettivamente raggiunta. */
  readonly depth: number;
  /** Linee ordinate per multipv crescente (la prima e' la migliore). */
  readonly lines: readonly EngineLine[];
  /** Mossa scelta dal motore, in UCI. null se la posizione e' gia' finita. */
  readonly bestMove: string | null;
}

export interface AnalyseOptions {
  readonly depth: number;
  /** Quante linee alternative chiedere. Il bot ne ha bisogno per scegliere. */
  readonly multiPV: number;
}

export interface Engine {
  /**
   * Analizza una posizione. Una richiesta nuova ANNULLA quella in corso: durante una
   * partita l'utente muove piu' in fretta di quanto il motore finisca, e l'analisi
   * della posizione precedente non serve piu' a nessuno.
   */
  analyse(fen: string, options: AnalyseOptions): Promise<Analysis>;
  /** Interrompe l'analisi in corso (la Promise si risolve con quanto raccolto). */
  stop(): void;
  /** Chiude il motore e libera il worker. */
  quit(): void;
}

/**
 * Canale verso il motore: due metodi, cosi' lo stesso codice UCI gira sia sopra un
 * Web Worker (nel browser) sia sopra il modulo node di stockfish.js (script di
 * calibrazione). Senza questa astrazione la calibrazione non sarebbe automatizzabile.
 */
export interface UciTransport {
  send(command: string): void;
  onLine(listener: (line: string) => void): void;
  dispose(): void;
}
