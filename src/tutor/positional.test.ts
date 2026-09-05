import { describe, expect, it } from 'vitest';
import { features } from './features.js';
import { explainPositional } from './positional.js';

describe('features', () => {
  it('conta il riparo di pedoni davanti al re arroccato', () => {
    // Re in g1 con f2, g2, h2 davanti: riparo intatto.
    const intact = features('4k3/8/8/8/8/8/5PPP/6K1 w - - 0 1', 'w');
    expect(intact.kingShield).toBe(3);
    // Senza il pedone g: il riparo cala.
    const holed = features('4k3/8/8/8/8/6P1/5P1P/6K1 w - - 0 1', 'w');
    expect(holed.kingShield).toBe(3); // g3 resta nelle due traverse davanti al re
    const gone = features('4k3/8/8/8/8/8/5P1P/6K1 w - - 0 1', 'w');
    expect(gone.kingShield).toBe(2);
  });

  it('riconosce un pedone passato', () => {
    // Pedone bianco in d5, nessun pedone nero su c, d o e davanti a lui.
    const passed = features('4k3/8/8/3P4/8/8/8/4K3 w - - 0 1', 'w');
    expect(passed.passedPawns).toBe(1);
    // Con un pedone nero in c6 non lo e' piu'.
    const stopped = features('4k3/8/2p5/3P4/8/8/8/4K3 w - - 0 1', 'w');
    expect(stopped.passedPawns).toBe(0);
  });

  it('riconosce pedoni isolati e doppiati', () => {
    // Due pedoni sulla colonna a e nessuno sulla b: doppiati e isolati.
    const result = features('4k3/8/8/8/P7/P7/8/4K3 w - - 0 1', 'w');
    expect(result.doubledPawns).toBe(1);
    expect(result.isolatedPawns).toBe(2);
  });

  it('riconosce un avamposto avversario nella nostra meta\' campo', () => {
    // Cavallo nero in d4 (meta' campo bianca) e nessun pedone bianco che lo scacci:
    // e' installato. Il pedone in c2 non conta, e' troppo indietro? no: c2 puo'
    // arrivare a c3 e scacciarlo, quindi NON e' un avamposto.
    const escapable = features('4k3/8/8/8/3n4/8/2P5/4K3 w - - 0 1', 'w');
    expect(escapable.enemyOutposts).toBe(0);
    // Senza pedoni sulle colonne adiacenti, invece, e' inamovibile.
    const outpost = features('4k3/8/8/8/3n4/8/8/4K3 w - - 0 1', 'w');
    expect(outpost.enemyOutposts).toBe(1);
  });

  it('vede la coppia degli alfieri', () => {
    expect(features('4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', 'w').bishopPair).toBe(true);
    expect(features('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', 'w').bishopPair).toBe(false);
  });
});

describe('explainPositional', () => {
  it('spiega il re rimasto scoperto', () => {
    const before = '4k3/8/8/8/8/8/5PPP/6K1 w - - 0 1';
    const after = '4k3/8/8/8/8/8/5P1P/6K1 w - - 0 1'; // sparito il pedone g2
    const explanations = explainPositional(before, after, 'w');
    // Manca un solo pedone: la frase al singolare, non "mancano 1 pedoni".
    expect(explanations[0]!.key).toBe('posKingShieldOne');
  });

  it('spiega la perdita di un pedone passato', () => {
    const before = '4k3/8/8/3P4/8/8/8/4K3 w - - 0 1';
    const after = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    const keys = explainPositional(before, after, 'w').map((e) => e.key);
    expect(keys).toContain('posLostPassed');
  });

  it('tace quando non e\' cambiato niente di rilevante', () => {
    // Il re fa un passo e torna: nessuna caratteristica si muove abbastanza.
    const position = '4k3/8/8/8/8/8/5PPP/6K1 w - - 0 1';
    expect(explainPositional(position, position, 'w')).toEqual([]);
  });

  it('non dice piu\' di due cose', () => {
    // Posizione peggiorata su molti fronti insieme: si sceglie comunque il meglio.
    const before = '4k3/8/8/3P4/8/8/2B2PPP/2B1K3 w - - 0 1';
    const after = '4k3/8/3n4/8/8/8/5P2/4K3 w - - 0 1';
    expect(explainPositional(before, after, 'w').length).toBeLessThanOrEqual(2);
  });
});
