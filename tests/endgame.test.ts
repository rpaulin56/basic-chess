import { describe, expect, it } from 'vitest';
import { classifyEndgame, countMaterial, reachableEndgames } from '../src/endgame/endgame.js';

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

/**
 * "Potresti arrivare a questo finale": solo se per arrivarci non si regala materiale.
 *
 * Nati da una partita vera, dove l'annuncio compariva nel momento sbagliato, e da una
 * prova in cui un Alfiere dato per un pedone veniva chiamato "cambio".
 */
describe('reachableEndgames', () => {
  const keys = (fen: string): string[] => reachableEndgames(fen).map((endgame) => endgame.key);

  it('riprendere la Donna appena presa porta al finale di Torri', () => {
    // Partita vera, prima di 48.Rxc6: la Nonna aveva appena giocato 47...Qxc6.
    expect(keys('1r2k3/2p4p/2q5/4P1p1/1P3P2/1R4P1/7P/2R3K1 w - - 0 48')).toContain('egRooks');
  });

  it('un cambio alla pari, Cavallo per Alfiere, conta', () => {
    expect(keys('r5k1/pp3ppp/2b5/8/3N4/8/PP3PPP/R5K1 w - - 0 1')).toContain('egRooks');
  });

  it("l'Alfiere dato per un pedone non e' un cambio", () => {
    expect(keys('r5k1/6pp/8/8/8/3B4/8/R5K1 w - - 0 1')).toEqual([]);
  });

  it('la Torre data per un Cavallo difeso nemmeno', () => {
    expect(keys('r5k1/pp3ppp/2n5/8/8/8/PP3PPP/2R3K1 w - - 0 1')).toEqual([]);
  });

  it("da un finale gia' raggiunto non annuncia niente", () => {
    expect(keys('4r3/5ppp/8/8/8/8/5PPP/4RK1k w - - 0 1')).toEqual([]);
  });
});
