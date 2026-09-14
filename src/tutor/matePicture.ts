import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

/**
 * La "fotografia del matto": dove andranno i pezzi che lo danno.
 *
 * Nei finali chi impara non sa quasi mai dove sta andando. Una mossa suggerita risponde
 * a "che cosa gioco adesso"; questa immagine risponde a "qual e' il piano": dove spingere
 * il re nemico e con quale configurazione chiuderlo.
 *
 * Si segue la linea del motore fino al matto e si guardano le nove case critiche (quella
 * del re e le otto intorno). Partecipano:
 * - i pezzi che STANNO su una di quelle case, di qualunque colore: il re nemico, i suoi
 *   pezzi che lo chiudono, i nostri a contatto;
 * - i NOSTRI pezzi che ne CONTROLLANO almeno una. Quelli nemici che le controllano non
 *   fanno parte della rete, anzi la contrastano: mostrarli sarebbe rumore.
 * Il nostro re non ha una regola apposta: quando serve controlla una casa accanto, e
 * rientra da solo.
 *
 * E' un ESEMPIO: la linea presuppone la difesa migliore, e se l'avversario si difende
 * altrimenti la configurazione cambia. Si ricalcola a ogni mossa.
 */

export interface MatePiece {
  /** Dove sta adesso. */
  readonly from: Square;
  /** Dove sara' nella posizione di matto. */
  readonly to: Square;
  readonly color: Color;
  /** Il pezzo nella posizione di matto: un pedone promosso arriva come donna. */
  readonly type: PieceSymbol;
}

export interface MatePicture {
  /** Il colore che subisce il matto. */
  readonly mated: Color;
  readonly pieces: readonly MatePiece[];
}

const FILES = 'abcdefgh';

function around(square: Square): Square[] {
  const file = FILES.indexOf(square[0]!);
  const rank = Number(square[1]);
  const out: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const f = file + df;
      const r = rank + dr;
      if (f >= 0 && f < 8 && r >= 1 && r <= 8) out.push(`${FILES[f]}${r}` as Square);
    }
  }
  return out;
}

/**
 * La fotografia, o null se la linea non arriva al matto (il motore a volte tronca il
 * seguito prima della fine).
 */
export function matePicture(fen: string, pv: readonly string[]): MatePicture | null {
  const chess = new Chess(fen);
  // Da dove viene ogni pezzo: si segue la casa, mossa per mossa, cosi' due torri non si
  // scambiano e un pedone promosso parte dalla sua casa di adesso.
  const origin = new Map<Square, Square>();
  for (const row of chess.board()) for (const cell of row) if (cell) origin.set(cell.square, cell.square);

  for (const uci of pv) {
    let move;
    try {
      move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci[4] } : {}),
      });
    } catch {
      return null;
    }
    const start = origin.get(move.from);
    origin.delete(move.from);
    origin.delete(move.to);
    if (start) origin.set(move.to, start);
    // L'arrocco muove anche la torre.
    if (move.isKingsideCastle() || move.isQueensideCastle()) {
      const rank = move.color === 'w' ? '1' : '8';
      const [rookFrom, rookTo] = move.isKingsideCastle() ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`];
      const rookStart = origin.get(rookFrom as Square);
      origin.delete(rookFrom as Square);
      if (rookStart) origin.set(rookTo as Square, rookStart);
    }
    // La presa en passant toglie un pedone da una casa diversa dall'arrivo.
    if (move.isEnPassant()) origin.delete(`${move.to[0]}${move.from[1]}` as Square);
    if (chess.isCheckmate()) break;
  }
  if (!chess.isCheckmate()) return null;

  const mated = chess.turn();
  const winner: Color = mated === 'w' ? 'b' : 'w';
  const kingSquare = chess.findPiece({ type: 'k', color: mated })[0];
  if (!kingSquare) return null;
  const critical = around(kingSquare);

  const involved = new Set<Square>();
  for (const square of critical) if (chess.get(square)) involved.add(square);
  // Il controllo si misura SENZA il re nemico: una torre che da' scacco lungo la colonna
  // controlla anche la casa dietro di lui, e lasciandolo li' risulterebbe libera.
  const withoutKing = new Chess(chess.fen(), { skipValidation: true });
  withoutKing.remove(kingSquare);
  for (const square of critical) {
    for (const attacker of withoutKing.attackers(square, winner)) involved.add(attacker);
  }

  const pieces: MatePiece[] = [];
  for (const square of involved) {
    const piece = chess.get(square);
    const from = origin.get(square);
    if (!piece || !from) continue;
    pieces.push({ from, to: square, color: piece.color, type: piece.type });
  }
  return { mated, pieces };
}
