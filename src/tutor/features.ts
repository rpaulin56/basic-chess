import { Chess, type Color, type Square } from 'chess.js';

/**
 * Caratteristiche posizionali misurabili.
 *
 * Servono all'errore STRATEGICO, l'unico che non si spiega mostrando una cattura:
 * la valutazione crolla, il materiale resta pari, e bisogna dire a parole cosa e'
 * peggiorato. Le si calcola PRIMA della mossa e nella posizione futura, e si
 * raccontano le differenze piu' grosse (vedi positional.ts).
 *
 * Sono euristiche, non verita': misurano cose che un maestro guarderebbe, con
 * definizioni standard e volutamente semplici. Il criterio di scelta e' stato uno
 * solo — includere una caratteristica solo se, cambiando, produce una frase che
 * insegna qualcosa a un principiante.
 */

export interface Features {
  /** Pedoni propri a riparo del re (le tre colonne del re, entro due traverse). */
  readonly kingShield: number;
  /** Colonne aperte o semiaperte che puntano sul proprio re, occupate dal nemico. */
  readonly kingOpenFiles: number;
  /** Case attorno al proprio re controllate dall'avversario. */
  readonly kingAttackers: number;
  /** Pedoni passati propri. */
  readonly passedPawns: number;
  /** Pedoni isolati propri (nessun pedone amico sulle colonne adiacenti). */
  readonly isolatedPawns: number;
  /** Pedoni doppiati propri (conteggio degli eccessi per colonna). */
  readonly doubledPawns: number;
  /** Vero se si ha la coppia degli alfieri. */
  readonly bishopPair: boolean;
  /** Numero di mosse legali a disposizione: misura grezza ma efficace della mobilita'. */
  readonly mobility: number;
  /** Cavalli avversari installati nella nostra meta' e non scacciabili da un pedone. */
  readonly enemyOutposts: number;
  /** Torri proprie su colonne senza pedoni propri. */
  readonly rooksOnOpenFiles: number;
}

const FILES = 'abcdefgh';

function squareOf(file: number, rank: number): Square {
  return `${FILES[file]}${rank}` as Square;
}

/** Tutte le case occupate da un pezzo di un dato colore e tipo. */
function find(chess: Chess, color: Color, type: string): Square[] {
  const found: Square[] = [];
  for (const row of chess.board()) {
    for (const square of row) {
      if (square && square.color === color && square.type === type) found.push(square.square);
    }
  }
  return found;
}

function fileOf(square: Square): number {
  return square.charCodeAt(0) - 97;
}

function rankOf(square: Square): number {
  return Number(square[1]);
}

/**
 * Mobilita': quante mosse legali avrebbe quel colore se toccasse a lui.
 *
 * Il trucco del FEN con il tratto forzato e' necessario perche' chess.js elenca le
 * mosse solo di chi ha il tratto. Puo' produrre una posizione formalmente illegale
 * (con il re avversario sotto scacco): in quel caso la mobilita' non e' calcolabile e
 * si restituisce quella che c'e', invece di far esplodere tutto.
 */
function mobilityOf(fen: string, color: Color): number {
  const parts = fen.split(' ');
  parts[1] = color;
  parts[3] = '-'; // l'en passant di un altro turno non ha senso qui
  try {
    return new Chess(parts.join(' ')).moves().length;
  } catch {
    return 0;
  }
}

export function features(fen: string, color: Color): Features {
  const chess = new Chess(fen);
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const forward = color === 'w' ? 1 : -1;

  const ownPawns = find(chess, color, 'p');
  const enemyPawns = find(chess, enemy, 'p');
  const ownFiles = new Set(ownPawns.map(fileOf));

  // --- struttura pedonale ---
  let passedPawns = 0;
  let isolatedPawns = 0;
  for (const pawn of ownPawns) {
    const file = fileOf(pawn);
    const rank = rankOf(pawn);
    const blocked = enemyPawns.some(
      (other) =>
        Math.abs(fileOf(other) - file) <= 1 &&
        (rankOf(other) - rank) * forward > 0,
    );
    if (!blocked) passedPawns++;
    if (!ownFiles.has(file - 1) && !ownFiles.has(file + 1)) isolatedPawns++;
  }
  const perFile = new Map<number, number>();
  for (const pawn of ownPawns) perFile.set(fileOf(pawn), (perFile.get(fileOf(pawn)) ?? 0) + 1);
  const doubledPawns = [...perFile.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);

  // --- re ---
  const king = find(chess, color, 'k')[0];
  let kingShield = 0;
  let kingOpenFiles = 0;
  let kingAttackers = 0;
  if (king) {
    const kingFile = fileOf(king);
    const kingRank = rankOf(king);
    for (let file = Math.max(0, kingFile - 1); file <= Math.min(7, kingFile + 1); file++) {
      for (let step = 1; step <= 2; step++) {
        const rank = kingRank + step * forward;
        if (rank < 1 || rank > 8) continue;
        const piece = chess.get(squareOf(file, rank));
        if (piece && piece.type === 'p' && piece.color === color) kingShield++;
      }
      // Una colonna senza nostri pedoni, con una torre o una donna avversaria sopra,
      // e' la strada maestra verso il nostro re.
      if (!ownFiles.has(file)) {
        const heavy = [...find(chess, enemy, 'r'), ...find(chess, enemy, 'q')];
        if (heavy.some((square) => fileOf(square) === file)) kingOpenFiles++;
      }
    }
    // Case attorno al re controllate dall'avversario: `isAttacked` fa il lavoro sporco.
    for (let file = Math.max(0, kingFile - 1); file <= Math.min(7, kingFile + 1); file++) {
      for (let rank = Math.max(1, kingRank - 1); rank <= Math.min(8, kingRank + 1); rank++) {
        if (chess.isAttacked(squareOf(file, rank), enemy)) kingAttackers++;
      }
    }
  }

  // --- pezzi ---
  const bishops = find(chess, color, 'b');
  const rooksOnOpenFiles = find(chess, color, 'r').filter(
    (rook) => !ownFiles.has(fileOf(rook)),
  ).length;

  // Un avamposto: cavallo avversario nella nostra meta' campo che nessun nostro pedone
  // puo' scacciare. E' la definizione che un maestro userebbe a voce.
  const enemyOutposts = find(chess, enemy, 'n').filter((knight) => {
    const rank = rankOf(knight);
    // "Nella nostra meta'" vuol dire dalla nostra parte della scacchiera: per il
    // Bianco le traverse 1-4. Un cavallo nero piantato in d4 e' il caso tipico.
    const inOurHalf = color === 'w' ? rank <= 4 : rank >= 5;
    if (!inOurHalf) return false;
    const file = fileOf(knight);
    return !ownPawns.some(
      (pawn) =>
        Math.abs(fileOf(pawn) - file) === 1 && (rank - rankOf(pawn)) * forward > 0,
    );
  }).length;

  return {
    kingShield,
    kingOpenFiles,
    kingAttackers,
    passedPawns,
    isolatedPawns,
    doubledPawns,
    bishopPair: bishops.length >= 2,
    mobility: mobilityOf(fen, color),
    enemyOutposts,
    rooksOnOpenFiles,
  };
}
