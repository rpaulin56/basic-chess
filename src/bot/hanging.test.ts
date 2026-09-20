import { describe, expect, it } from 'vitest';
import { giveaway, hangsMaterial } from './hanging.js';

describe('giveaway', () => {
  it('conta la Torre lasciata al pedone', () => {
    // Torre in a1: in b5 la prende il pedone c6, e nessuno riprende.
    const fen = '4k3/8/2p5/8/8/8/8/1R2K3 w - - 0 1';
    expect(giveaway(fen, 'b1a1')).toBe(0);
    expect(giveaway(fen, 'b1b5')).toBe(5);
  });

  it("non e' un regalo se chi prende ci rimette di piu'", () => {
    // Qxd1 prende la Torre ma il Re riprende: la Donna vale piu' di quanto guadagna.
    const fen = '3qk3/8/8/8/8/8/8/R3K3 w - - 0 1';
    expect(giveaway(fen, 'a1d1')).toBe(0);
  });

  it('vede il Cavallo che si mette sotto un pedone', () => {
    // Cavallo in e3: in c5 e in e5 lo prende il pedone d6.
    const fen = '4k3/8/3p4/8/8/4N3/8/4K3 w - - 0 1';
    expect(giveaway(fen, 'e3c4')).toBe(0);
    expect(giveaway(fen, 'e3c2')).toBe(0);
    expect(giveaway('4k3/8/3p4/8/4N3/8/8/4K3 w - - 0 1', 'e4c5')).toBe(3);
  });

  it('non conta lo scambio alla pari', () => {
    // Il Cavallo prende un pedone difeso da un altro pedone: si riprende, resta un pedone.
    const fen = '4k3/8/8/3pp3/4N3/8/8/4K3 w - - 0 1';
    expect(giveaway(fen, 'e4d6')).toBe(0);
  });

  it('un pezzo gia\u0027 in presa non e\u0027 colpa della mossa che si sceglie', () => {
    // Il Cavallo in e5 e' gia' sotto il pedone d6, e nessuna mossa di Re lo salva.
    const fen = '4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1';
    expect(giveaway(fen, 'e1d1')).toBe(3);
    expect(hangsMaterial(fen, 'e1d1', 'e1f1')).toBe(false);
  });
});
