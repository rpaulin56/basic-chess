import { describe, expect, it } from 'vitest';
import { newGame, playMove } from '../src/core/game.js';
import { parsePgn, toPgn, type Annotation } from '../src/core/pgn.js';
import type { GameState } from '../src/core/game.js';

/** Gioca una sequenza in notazione UCI e restituisce lo stato. */
function play(moves: readonly string[], fen?: string): GameState {
  let state = fen ? newGame(fen) : newGame();
  for (const uci of moves) {
    const next = playMove(
      state,
      uci.slice(0, 2) as never,
      uci.slice(2, 4) as never,
      (uci.slice(4) || undefined) as never,
    );
    if (!next) throw new Error(`mossa non valida nel test: ${uci}`);
    state = next;
  }
  return state;
}

const SCHOLAR = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];

describe('toPgn', () => {
  it('mette i sette tag obbligatori per primi e nell\'ordine dello standard', () => {
    const pgn = toPgn(play(['e2e4']), { White: 'Human', ECO: 'B00' });
    const tags = [...pgn.matchAll(/^\[(\w+) /gm)].map((match) => match[1]);
    expect(tags.slice(0, 7)).toEqual([
      'Event',
      'Site',
      'Date',
      'Round',
      'White',
      'Black',
      'Result',
    ]);
    // I tag in piu' vengono dopo, non in mezzo.
    expect(tags).toContain('ECO');
    expect(tags.indexOf('ECO')).toBeGreaterThan(6);
  });

  it('calcola il risultato dalla posizione finale', () => {
    expect(toPgn(play(SCHOLAR))).toContain('[Result "1-0"]');
    expect(toPgn(play(['e2e4']))).toContain('[Result "*"]');
  });

  it('appende il suffisso alla mossa sbagliata', () => {
    const annotations = new Map<number, Annotation>([
      [2, { suffix: '??', comment: '[%bc tactical,40,kept]' }],
    ]);
    const pgn = toPgn(play(SCHOLAR), {}, annotations);
    expect(pgn).toContain('Bc4??');
    expect(pgn).toContain('{[%bc tactical,40,kept]}');
  });

  it('numera la mossa del Nero quando un commento ha interrotto il filo', () => {
    // Commento sulla mossa del Bianco: quella del Nero che segue deve portare "1..."
    const pgn = toPgn(play(['e2e4', 'e7e5']), {}, new Map([[0, { comment: 'nota' }]]));
    expect(pgn).toMatch(/1\. e4 \{nota\} 1\.\.\. e5/);
    // Senza commento invece no: sarebbe rumore.
    expect(toPgn(play(['e2e4', 'e7e5']))).toMatch(/1\. e4 e5/);
  });

  it('numera dalla mossa giusta quando si parte da una posizione data', () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 24';
    const pgn = toPgn(play(['e8d8'], fen));
    expect(pgn).toContain('[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 24"]');
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toMatch(/24\.\.\. Kd8/);
  });

  it('spezza i commenti lunghi senza rompere il PGN', () => {
    const lungo =
      'Un commento lungo puo' + "'" + ' sempre arrivare da un PGN altrui, o da noi il ' +
      'giorno che ci servisse: deve stare negli ottanta caratteri lo stesso.';
    const pgn = toPgn(play(SCHOLAR), {}, new Map([[2, { comment: lungo, suffix: '??' }]]));
    for (const line of pgn.split('\n')) expect(line.length).toBeLessThanOrEqual(80);
    // Spezzato in due righe, ma il commento e' lo stesso: dentro le graffe gli a capo
    // non contano, e rileggendolo si ritrova intero.
    expect(parsePgn(pgn).comments.get(2)?.replace(/\s+/g, ' ')).toBe(lungo);
  });

  it('non manda righe oltre gli 80 caratteri', () => {
    const long = play([
      'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7',
      'f1e1', 'b7b5', 'a4b3', 'd7d6', 'c2c3', 'e8g8', 'h2h3', 'c6b8', 'd2d4', 'b8d7',
    ]);
    for (const line of toPgn(long).split('\n')) expect(line.length).toBeLessThanOrEqual(80);
  });

  it('protegge le virgolette dentro un tag', () => {
    expect(toPgn(play(['e2e4']), { White: 'Tizio "il Lungo"' })).toContain(
      '[White "Tizio \\"il Lungo\\""]',
    );
  });

  it('si rilegge da solo, commenti compresi', () => {
    const annotations = new Map<number, Annotation>([
      [4, { suffix: '?', comment: '[%bc tactical,20,kept]' }],
    ]);
    const parsed = parsePgn(toPgn(play(SCHOLAR), { White: 'Human' }, annotations));
    expect(parsed.state.plies.map((ply) => ply.san)).toEqual([
      'e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#',
    ]);
    expect(parsed.tags['White']).toBe('Human');
    expect(parsed.comments.get(4)).toContain('[%bc tactical,20,kept]');
  });

  it('conserva la posizione di partenza attraverso un giro completo', () => {
    const fen = '8/8/8/8/8/4k3/4P3/4K1Rr w - - 0 1';
    // Rg8 sarebbe illegale: togliendo la torre da g1 il re bianco resta sotto la
    // torre nera in h1. Si prende invece la torre.
    const parsed = parsePgn(toPgn(play(['g1h1'], fen)));
    expect(parsed.state.startFen).toBe(fen);
    expect(parsed.state.plies[0]?.san).toBe('Rxh1');
  });
});
