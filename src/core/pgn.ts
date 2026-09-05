import { Chess } from 'chess.js';
import { gameOver, goTo, newGame, playMove, INITIAL_FEN, type GameState } from './game.js';

/**
 * Import/export PGN.
 *
 * Deleghiamo il parsing a chess.js (che gestisce tag, commenti, varianti scartate,
 * NAG) e poi RICOSTRUIAMO il nostro stato immutabile rigiocando le mosse: cosi'
 * ogni Ply ha il suo fenBefore/fenAfter come se la partita fosse stata giocata qui,
 * e il tutor puo' analizzare una partita importata esattamente come una giocata.
 */

export interface PgnTags {
  readonly [tag: string]: string;
}

export interface ParsedPgn {
  readonly state: GameState;
  readonly tags: PgnTags;
}

export function parsePgn(pgn: string): ParsedPgn {
  const chess = new Chess();
  chess.loadPgn(pgn); // lancia se il PGN e' malformato: lo gestisce il chiamante
  const tags = chess.getHeaders() as PgnTags;

  // Il tag FEN indica una posizione di partenza diversa da quella iniziale.
  const startFen = typeof tags['FEN'] === 'string' && tags['FEN'] ? tags['FEN'] : INITIAL_FEN;

  let state = newGame(startFen);
  for (const move of chess.history({ verbose: true })) {
    const next = playMove(
      state,
      move.from,
      move.to,
      move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    );
    if (!next) throw new Error(`Mossa non rigiocabile durante l'import: ${move.san}`);
    state = next;
  }
  return { state, tags };
}

/**
 * Esporta il PGN. Esporta la partita INTERA, non solo fino al cursore: il cursore e'
 * una posizione di lettura, non un troncamento della partita (per troncare davvero
 * c'e' truncateHere).
 */
export function toPgn(state: GameState, tags: PgnTags = {}): string {
  const chess = new Chess(state.startFen);
  for (const ply of state.plies) {
    chess.move({ from: ply.from, to: ply.to, ...(ply.promotion ? { promotion: ply.promotion } : {}) });
  }
  const today = new Date();
  const date = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  // Result calcolato dalla posizione finale: un PGN esportato con "*" su una partita
  // gia' conclusa viene riletto come partita interrotta da qualunque altro programma.
  const headers: Record<string, string> = { Event: 'Basic Chess', Date: date, Result: resultOf(state), ...tags };
  if (state.startFen !== INITIAL_FEN) {
    headers['SetUp'] = '1';
    headers['FEN'] = state.startFen;
  }
  for (const [key, value] of Object.entries(headers)) chess.setHeader(key, value);
  return chess.pgn();
}

function resultOf(state: GameState): string {
  const over = gameOver(goTo(state, state.plies.length));
  if (!over) return '*';
  if (over.winner === 'w') return '1-0';
  if (over.winner === 'b') return '0-1';
  return '1/2-1/2';
}
