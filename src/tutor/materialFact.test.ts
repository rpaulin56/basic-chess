import { describe, expect, it } from 'vitest';
import { materialFact } from './materialFact.js';

describe('materialFact', () => {
  it('il pezzo lasciato in presa, con la cattura che lo prende', () => {
    // Il Cavallo in e4 va in c5, dove lo prende il pedone d6; la migliore lo tiene in f2.
    const fen = '4k3/8/3p4/8/4N3/8/8/4K3 w - - 0 1';
    expect(materialFact(fen, 'e4c5', 'e4f2')).toEqual({ kind: 'lost', piece: 'n', move: 'dxc5' });
  });

  it('il pezzo da prendere che non si prende', () => {
    // La Torre nera in d5 e' in presa del Cavallo in f4; si gioca una mossa di Re.
    const fen = '4k3/8/8/3r4/5N2/8/8/4K3 w - - 0 1';
    expect(materialFact(fen, 'e1f1', 'f4d5')).toEqual({ kind: 'missed', piece: 'r', move: 'Nxd5' });
  });

  it("niente da dire se la mossa giocata e' la migliore", () => {
    const fen = '4k3/8/8/3r4/5N2/8/8/4K3 w - - 0 1';
    expect(materialFact(fen, 'f4d5', 'f4d5')).toBeNull();
  });

  it('niente da dire per un pedone', () => {
    // La migliore prende un pedone, la giocata no: un pedone non e' un fatto da raccontare.
    const fen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
    expect(materialFact(fen, 'e1d1', 'e4d5')).toBeNull();
  });

  it("un pezzo gia' perso con qualunque mossa non e' colpa di questa", () => {
    // Il Cavallo in c5 e' gia' sotto il pedone d6: la mossa di Re non cambia niente.
    const fen = '4k3/8/3p4/2N5/8/8/8/4K3 w - - 0 1';
    expect(materialFact(fen, 'e1d1', 'e1f1')).toBeNull();
  });
});
