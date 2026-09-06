import { Chess, type Square } from 'chess.js';

/**
 * Classificazione dell'errore e costruzione di cio' che va MOSTRATO.
 *
 * La cascata e' quella decisa a tavolino col committente, e l'ordine non e'
 * negoziabile: prima si prova "banale", poi "tattico", e "strategico" e' quel che
 * resta. Cosi' la categoria piu' difficile da spiegare e' anche quella che si
 * raggiunge solo quando le altre due sono state escluse.
 *
 * Funzione pura: riceve una posizione e una linea di confutazione, restituisce una
 * descrizione. Non conosce ne' motore ne' interfaccia.
 */

export type Category =
  /** Il pezzo se lo prendono subito: basta mostrare la risposta. */
  | 'banale'
  /** La perdita si manifesta qualche mossa piu' avanti, lungo una linea forzante. */
  | 'tattico'
  /** Nessuna perdita di materiale all'orizzonte: la posizione peggiora e basta. */
  | 'strategico';

/**
 * Un pezzo che si perde lungo la variante.
 *
 * Serve a NOMINARLO invece di contarlo: "perdi il pedone passato in c6" dice a un
 * principiante qualcosa che "perdi un pedone" non dice, e "perdi materiale" ancora
 * meno. (In italiano, oltretutto, "pezzo" esclude il pedone: chiamare "pezzo" un
 * pedone e' proprio sbagliato.)
 */
export interface LostPiece {
  /** Casa da cui il pezzo e' partito, cioe' dove l'utente lo vede adesso. */
  readonly square: Square;
  readonly type: 'p' | 'n' | 'b' | 'r' | 'q';
  /** Vero solo per un pedone passato: e' una perdita di natura diversa. */
  readonly passed: boolean;
}

/**
 * Una freccia della variante: una singola semi-mossa.
 *
 * Una prima versione disegnava UNA freccia per pezzo, dalla casa attuale a quella
 * finale (b8->d4 per un cavallo che passa da c6). Sembrava piu' pulita ma nascondeva
 * proprio la cosa da imparare: il PERCORSO. Ora ogni semi-mossa ha la sua freccia, e
 * due mosse dello stesso pezzo si leggono concatenate (b8->c6, c6->d4).
 */
export interface Arrow {
  readonly orig: Square;
  readonly dest: Square;
  /** 'red' = pezzi dell'avversario, 'blue' = i nostri, 'yellow' = pezzi che perdiamo. */
  readonly brush: 'red' | 'blue' | 'yellow';
}

export interface Consequence {
  readonly category: Category;
  /** La confutazione, in UCI, troncata all'orizzonte utile. */
  readonly line: readonly string[];
  /** Le stesse mosse in SAN, per la lista sotto il diagramma. */
  readonly san: readonly string[];
  /**
   * Dopo quante semi-mosse la conseguenza si vede. E' la posizione da mostrare:
   * mostrare tutta la variante fino in fondo confonderebbe e basta.
   */
  readonly manifestAt: number;
  /** Materiale perso in pedoni (0 per l'errore strategico). */
  readonly materialLoss: number;
  /** Le frecce della variante, una per semi-mossa, fino alla manifestazione. */
  readonly arrows: readonly Arrow[];
  /**
   * I pezzi che si perdono, con il loro nome. Vuoto quando la perdita e' il saldo di
   * uno scambio invece che di pezzi lasciati per strada: in quel caso nominarli
   * sarebbe fuorviante (vedi `lossKind`).
   */
  readonly lost: readonly LostPiece[];
  /**
   * Come va DETTA la perdita:
   *  - 'named'    si possono nominare i pezzi ("perdi il pedone passato in c6")
   *  - 'exchange' e' la qualita', cioe' torre contro pezzo leggero: ha un nome suo e
   *               un giocatore lo usa, quindi va usato invece del conteggio
   *  - 'count'    resta solo il saldo ("l'equivalente di due pedoni"). Gli scambi
   *               sbilanciati piu' complessi (due leggeri per una torre, donna per
   *               torre e alfiere) non hanno un nome breve e finiscono qui — ma sono
   *               anche i casi in cui il giudizio e' quasi sempre posizionale.
   */
  readonly lossKind: 'named' | 'exchange' | 'count';
  /** Vero se la linea e' fatta quasi solo di scacchi e catture: l'utente non aveva scampo. */
  readonly forcing: boolean;
  /**
   * In quante MOSSE arriva il matto, se la confutazione e' un matto forzato. null
   * altrimenti. Va detto prima di ogni conto sul materiale: a chi viene mattato non
   * interessa quale pedone ha perso per strada.
   */
  readonly matesIn: number | null;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Bilancio materiale dal punto di vista di `color`, in pedoni. */
function materialBalance(chess: Chess, color: 'w' | 'b'): number {
  let balance = 0;
  for (const row of chess.board()) {
    for (const square of row) {
      if (!square) continue;
      balance += (square.color === color ? 1 : -1) * (VALUE[square.type] ?? 0);
    }
  }
  return balance;
}

/**
 * Orizzonte di analisi: oltre questa profondita' la "conseguenza" diventa una
 * previsione troppo remota per essere didattica. Otto semi-mosse sono quattro mosse
 * per parte: abbastanza per una combinazione, non tanto da sembrare magia.
 */
const HORIZON = 8;

/** Sotto questa perdita (in pedoni) non si parla di errore materiale. */
const MATERIAL_THRESHOLD = 1;


/**
 * Dove la variante e' "assestata", cioe' dove ha senso contare il materiale.
 *
 * Se la variante del motore finisce prima dell'orizzonte, la posizione finale e' gia'
 * assestata. Se invece siamo noi ad averla troncata, ci si ferma all'ultima semi-mossa
 * PARI: dopo una dispari puo' esserci una ricattura in sospeso, e contare li'
 * scambierebbe per una perdita un normale cambio di pezzi.
 */
function settledIndex(plies: number): number {
  return plies < HORIZON ? plies : plies - (plies % 2);
}

/**
 * Da quale semi-mossa il bilancio materiale e' ORMAI quello finale.
 *
 * Non e' il minimo lungo la variante, ed e' una correzione pagata su una partita
 * vera: dopo 8.a3 il Nero prende il cavallo in c3, ma tre semi-mosse dopo il Bianco
 * recupera un pezzo con Cxd4. Guardando il minimo il tutor annunciava "perdi il
 * cavallo in c3"; il conto vero e' un pedone. Un compenso che arriva con qualche
 * mossa di ritardo (uno scacco intermedio, una ritirata e poi la ricattura) e' del
 * tutto normale a scacchi, e una regola che pretende la ricattura immediata sbaglia
 * ogni volta che c'e' di mezzo una mossa intermedia.
 */
function manifestIndex(balances: readonly number[], settled: number, final: number): number {
  for (let i = 1; i <= settled; i++) {
    if (balances[i] !== final) continue;
    // Dev'essere il punto in cui la situazione si stabilizza, non un passaggio: da
    // qui in poi il bilancio non deve piu' risalire sopra il valore finale.
    if (balances.slice(i, settled + 1).every((balance) => balance <= final)) return i;
  }
  return settled;
}

export function classifyConsequence(
  /** Posizione DOPO la mossa sbagliata: tocca all'avversario. */
  fenAfterMistake: string,
  /** Confutazione prevista dal motore, in UCI. */
  refutation: readonly string[],
): Consequence | null {
  const chess = new Chess(fenAfterMistake);
  // Chi ha sbagliato e' quello che NON ha il tratto adesso.
  const victim: 'w' | 'b' = chess.turn() === 'w' ? 'b' : 'w';

  const line: string[] = [];
  const san: string[] = [];
  let matesIn: number | null = null;
  /** Semi-mossa in cui arriva il matto: e' li' che la variante si ferma. */
  let mateAtPly = 0;
  const balances: number[] = [materialBalance(chess, victim)];
  let forcingMoves = 0;

  for (const uci of refutation.slice(0, HORIZON)) {
    let move;
    try {
      move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
      });
    } catch {
      break; // linea non rigiocabile: ci fermiamo a quel che abbiamo
    }
    line.push(uci);
    san.push(move.san);
    if (chess.isCheckmate() && matesIn === null) {
      matesIn = Math.ceil(line.length / 2);
      mateAtPly = line.length;
    }
    balances.push(materialBalance(chess, victim));
    // "Forzante" e' approssimato con scacchi e catture. Il criterio rigoroso
    // (chiedere al motore quante alternative c'erano in ogni nodo) costerebbe
    // un'analisi per semi-mossa: qui non vale il prezzo.
    if (move.san.includes('+') || move.san.includes('#') || move.captured) forcingMoves++;
  }

  if (line.length === 0) return null;

  const start = balances[0]!;
  const settledAt = settledIndex(line.length);
  const materialLoss = start - balances[settledAt]!;

  // Dove si manifesta: il momento in cui "si capisce", non la fine della variante.
  let manifestAt = line.length;
  // Il matto e' la conseguenza definitiva: la variante si ferma li', qualunque cosa
  // dica il conteggio del materiale.
  if (matesIn !== null) {
    manifestAt = mateAtPly;
  } else if (materialLoss >= MATERIAL_THRESHOLD) {
    manifestAt = manifestIndex(balances, settledAt, balances[settledAt]!);
  }

  // "Immediato" vuol dire entro una mossa per parte: se ti prendono un pezzo e tu
  // ricatturi, il conto e' chiuso li' e chiamarlo "arriva una mossa piu' avanti"
  // sarebbe pedanteria.
  const category: Category =
    materialLoss < MATERIAL_THRESHOLD ? 'strategico' : manifestAt <= 2 ? 'banale' : 'tattico';

  // Le FRECCE si fermano dove la conseguenza si vede; il CONTO di cosa si perde
  // arriva invece fino alla posizione assestata, altrimenti una ricattura che avviene
  // una semi-mossa dopo resterebbe fuori e uno scambio sembrerebbe una perdita secca.
  const { arrows } = replay(fenAfterMistake, line.slice(0, manifestAt));
  const { lost, won } = replay(fenAfterMistake, line.slice(0, Math.max(manifestAt, settledAt)));
  const lossKind = describeLoss(lost, won, materialLoss);

  return {
    category,
    line: line.slice(0, manifestAt),
    san: san.slice(0, manifestAt),
    manifestAt,
    materialLoss: Math.max(0, materialLoss),
    arrows,
    lost: lossKind === 'named' ? lost : [],
    lossKind,
    forcing: forcingMoves * 2 >= manifestAt,
    matesIn,
  };
}

/**
 * Decide COME va detta la perdita.
 *
 * I pezzi si nominano solo se spiegano DA SOLI tutto il saldo: se abbiamo perso una
 * torre ma catturato un cavallo, dire "perdi la torre" e' vero e fuorviante insieme.
 *
 * Quel caso pero' ha un nome che ogni giocatore conosce — la QUALITA' — e usarlo dice
 * molto piu' di "l'equivalente di due pedoni". Vale solo per torre contro pezzo
 * leggero: gli scambi sbilanciati piu' complessi non hanno un nome breve, e restano
 * al conteggio.
 */
function describeLoss(
  lost: readonly LostPiece[],
  won: readonly LostPiece['type'][],
  materialLoss: number,
): 'named' | 'exchange' | 'count' {
  const isMinor = (type: LostPiece['type']) => type === 'n' || type === 'b';
  if (lost.length === 1 && lost[0]!.type === 'r' && won.length === 1 && isMinor(won[0]!)) {
    return 'exchange';
  }
  // Si nominano i pezzi quando il compenso e' al massimo un pedone: "perdi la torre in
  // a8" resta vero e leggibile anche se per strada hai preso un pedone. Con un
  // compenso piu' sostanzioso il nome nasconderebbe meta' della storia.
  const compensation = won.reduce((sum, type) => sum + (VALUE[type] ?? 0), 0);
  if (lost.length > 0 && compensation <= 1 && materialLoss > 0) return 'named';
  return 'count';
}

/**
 * Un pedone e' passato se davanti a lui non c'e' nessun pedone avversario, ne' sulla
 * sua colonna ne' su quelle adiacenti. E' la definizione standard, e vale la pena
 * calcolarla perche' perdere un pedone passato non e' perdere "un pedone".
 */
function isPassedPawn(chess: Chess, square: Square, color: 'w' | 'b'): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const forward = color === 'w' ? 1 : -1;
  for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
    for (let r = rank + forward; r >= 1 && r <= 8; r += forward) {
      const piece = chess.get((String.fromCharCode(97 + f) + r) as Square);
      if (piece && piece.type === 'p' && piece.color !== color) return false;
    }
  }
  return true;
}

/**
 * Le frecce della variante: una per semi-mossa, nell'ordine in cui si gioca.
 *
 * L'identita' dei pezzi viene comunque seguita, ma serve a un'altra cosa: sapere DA
 * DOVE veniva un pezzo che viene catturato, per segnare il cerchio sulla casa in cui
 * l'utente lo vede adesso invece che su quella dove sparisce.
 */
export function transportArrows(fen: string, line: readonly string[]): Arrow[] {
  return replay(fen, line).arrows;
}

export function replay(
  fen: string,
  line: readonly string[],
): { arrows: Arrow[]; lost: LostPiece[]; won: LostPiece['type'][] } {
  const chess = new Chess(fen);
  const start = new Chess(fen);
  const victim: 'w' | 'b' = chess.turn() === 'w' ? 'b' : 'w';

  /** casa attuale -> (casa di partenza, colore) */
  const origin = new Map<string, { from: string; color: 'w' | 'b' }>();
  /** i nostri pezzi spariti perche' catturati, con il nome che avevano all'inizio */
  const lost: LostPiece[] = [];
  const arrows: Arrow[] = [];
  /** cosa abbiamo catturato noi: serve a riconoscere uno scambio da una perdita secca */
  const won: LostPiece['type'][] = [];

  for (const uci of line) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const moving = chess.get(from as Square);
    let move;
    try {
      move = chess.move({
        from,
        to,
        ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
      });
    } catch {
      break;
    }
    if (move.captured) {
      // Il pezzo catturato: se era nostro, e' una perdita da evidenziare. La casa da
      // mostrare e' quella di PARTENZA del pezzo perduto, non quella di cattura:
      // l'utente lo cerca dove lo vede adesso.
      const capturedAt = origin.get(to);
      if (move.color === victim) won.push(move.captured as LostPiece['type']);
      if (move.color !== victim) {
        const square = (capturedAt?.from ?? to) as Square;
        const type = move.captured as LostPiece['type'];
        lost.push({
          square,
          type,
          // Il "passato" si valuta nella posizione di PARTENZA, quella che l'utente
          // ha davanti: e' li' che la parola deve avere senso.
          passed: type === 'p' && isPassedPawn(start, square, victim),
        });
      }
      origin.delete(to);
    }
    const previous = origin.get(from);
    origin.delete(from);
    origin.set(to, { from: previous?.from ?? from, color: moving?.color ?? move.color });
    arrows.push({
      orig: from as Square,
      dest: to as Square,
      brush: (moving?.color ?? move.color) === victim ? 'blue' : 'red',
    });
  }


  // I pezzi perduti si segnano con una freccia "su se stessi": chessground disegna un
  // cerchio sulla casa, che e' esattamente il modo giusto di dire "questo sparisce".
  for (const piece of lost) {
    arrows.push({ orig: piece.square, dest: piece.square, brush: 'yellow' });
  }
  return { arrows, lost, won };
}
