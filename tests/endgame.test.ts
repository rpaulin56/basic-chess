import { describe, expect, it } from 'vitest';
import { classifyEndgame, countMaterial } from '../src/endgame/endgame.js';

describe('countMaterial', () => {
  it('distingue gli alfieri per colore di casa', () => {
    // Alfiere bianco in c1 (casa scura), alfiere nero in f8 (casa scura).
    const dark = countMaterial('5b2/8/8/8/8/8/8/2B1K2k w - - 0 1');
    expect(dark.white.darkBishops).toBe(1);
    expect(dark.white.lightBishops).toBe(0);
    expect(dark.black.darkBishops).toBe(1);

    // Alfiere bianco in f1 (casa chiara).
    const light = countMaterial('5b2/8/8/8/8/8/8/4KB1k w - - 0 1');
    expect(light.white.lightBishops).toBe(1);
    expect(light.white.darkBishops).toBe(0);
  });
});

describe('classifyEndgame', () => {
  it('riconosce re e pedone contro re', () => {
    expect(classifyEndgame('8/8/8/8/8/4k3/4P3/4K3 w - - 0 1')?.key).toBe('egKPvK');
  });

  it('riconosce i matti elementari', () => {
    expect(classifyEndgame('8/8/8/8/8/4k3/8/4K2R w - - 0 1')?.key).toBe('egKRvK');
    expect(classifyEndgame('8/8/8/8/8/4k3/8/3QK3 w - - 0 1')?.key).toBe('egKQvK');
    expect(classifyEndgame('8/8/8/8/8/2N1k3/8/2B1K3 w - - 0 1')?.key).toBe('egKBNvK');
  });

  it('riconosce torre e pedone contro torre, che e\' il finale pratico piu\' importante', () => {
    expect(classifyEndgame('8/8/8/8/8/4k3/4P3/4K1Rr w - - 0 1')?.key).toBe('egKRPvKR');
  });

  it('riconosce gli alfieri di colore contrario', () => {
    // Alfiere bianco in c1 (scura), alfiere nero in f8 (scura): STESSO colore.
    expect(classifyEndgame('5b2/4p3/8/8/8/8/4P3/2B1K2k w - - 0 1')?.key).not.toBe(
      'egOppositeBishops',
    );
    // Alfiere bianco in f1 (chiara), alfiere nero in f8 (scura): colori contrari.
    expect(classifyEndgame('5b2/4p3/8/8/8/8/4P3/4KB1k w - - 0 1')?.key).toBe('egOppositeBishops');
  });

  it('riconosce i finali di genere', () => {
    expect(classifyEndgame('8/5ppp/8/8/8/8/5PPP/4K1k1 w - - 0 1')?.key).toBe('egPawns');
    expect(classifyEndgame('4r3/5ppp/8/8/8/8/5PPP/4RK1k w - - 0 1')?.key).toBe('egRooks');
  });

  it('tace quando la partita e\' ancora mediogioco', () => {
    // Posizione iniziale: non e' un finale.
    expect(classifyEndgame('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
    // Con le donne in campo non e' finale, per quanto materiale sia stato cambiato.
    expect(classifyEndgame('3qk3/5ppp/8/8/8/8/5PPP/3QK3 w - - 0 1')).toBeNull();
    // Troppi pezzi per parlare di finale.
    expect(classifyEndgame('r1b1k1nr/pppp1ppp/8/8/8/8/PPPP1PPP/R1B1K1NR w - - 0 1')).toBeNull();
  });

  it('classifica dal lato con piu\' materiale, non dal Bianco', () => {
    // Il Nero ha torre e pedone, il Bianco la sola torre: e' lo stesso finale.
    expect(classifyEndgame('4k1rR/4p3/8/8/8/8/8/4K3 w - - 0 1')?.key).toBe('egKRPvKR');
  });

  it('propone risorse per ogni finale riconosciuto', () => {
    for (const fen of [
      '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1',
      '8/8/8/8/8/4k3/8/4K2R w - - 0 1',
      '8/5ppp/8/8/8/8/5PPP/4K1k1 w - - 0 1',
    ]) {
      const found = classifyEndgame(fen);
      expect(found?.resources.length).toBeGreaterThan(0);
      for (const resource of found!.resources) expect(resource.url).toMatch(/^https:\/\//);
    }
  });
});
