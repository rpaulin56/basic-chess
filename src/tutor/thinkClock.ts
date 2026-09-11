/**
 * Quanto ha pensato chi gioca, mossa per mossa.
 *
 * E' il primo passo verso l'analisi del tempo: incrociato con quanto costava una mossa
 * e con quanto era stretta la strada, dice cose che nessun numero da solo dice ("la
 * mossa che ti e' costata di piu' l'hai giocata in tre secondi"). Per ora si registra
 * soltanto, invisibile.
 *
 * Si conta solo il tempo che e' davvero di chi gioca: tocca a lui, sulla posizione che
 * ha davanti, con la pagina visibile. Non si conta mentre la Nonna pensa, mentre si
 * legge un verdetto o si guardano le conseguenze. Guardare una posizione passata conta
 * per QUELLA posizione, non per il turno in corso.
 *
 * Le sospensioni non si indovinano, quando si possono vedere: se la scheda va in secondo
 * piano, o la pagina riparte a turno gia' cominciato, il turno e' `interrupted`. Il
 * tempo si conserva lo stesso; chi fa i conti lo scarta. Resta chi lascia la pagina
 * aperta e va a fare altro: a quello pensera' la mediana.
 */

export interface ThinkTime {
  /** La semi-mossa giocata. */
  readonly ply: number;
  /** Il tempo passato davanti alla posizione, in millisecondi. */
  readonly ms: number;
  /** Il tempo misurato non e' tutto e solo pensiero: vedi sopra. */
  readonly interrupted: boolean;
}

interface Turn {
  ms: number;
  interrupted: boolean;
}

export class ThinkClock {
  private readonly now: () => number;
  /** Per posizione (FEN): una partita torna di rado due volte sulla stessa. */
  private readonly turns = new Map<string, Turn>();
  private running: { readonly fen: string; readonly since: number } | null = null;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  /**
   * Cosa c'e' davanti a chi gioca adesso: la posizione in cui tocca a lui, o null se il
   * tempo in questo momento non e' suo. Va chiamata a ogni cambiamento, e quando la
   * pagina diventa visibile o nascosta.
   */
  show(fen: string | null, visible: boolean): void {
    this.settle();
    if (fen === null) return;
    if (!visible) {
      this.turn(fen).interrupted = true;
      return;
    }
    this.turn(fen);
    this.running = { fen, since: this.now() };
  }

  /** Il turno su questa posizione e' cominciato prima che l'orologio lo vedesse. */
  markInterrupted(fen: string): void {
    this.turn(fen).interrupted = true;
  }

  /** Il tempo passato su una posizione, al momento di muovere da li'. Una volta sola. */
  take(fen: string): { ms: number; interrupted: boolean } | null {
    this.settle();
    const turn = this.turns.get(fen);
    this.turns.delete(fen);
    return turn ? { ms: Math.round(turn.ms), interrupted: turn.interrupted } : null;
  }

  reset(): void {
    this.turns.clear();
    this.running = null;
  }

  private settle(): void {
    if (!this.running) return;
    this.turn(this.running.fen).ms += this.now() - this.running.since;
    this.running = null;
  }

  private turn(fen: string): Turn {
    let turn = this.turns.get(fen);
    if (!turn) {
      turn = { ms: 0, interrupted: false };
      this.turns.set(fen, turn);
    }
    return turn;
  }
}
