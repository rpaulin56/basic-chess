import { describe, expect, it } from 'vitest';
import { matePicture } from './matePicture.js';

describe('matePicture', () => {
  it('segue i pezzi fino al matto e sceglie quelli attorno al re', () => {
    // Matto di torre: il re bianco fa opposizione, la torre chiude sull'ottava.
    const picture = matePicture('4k3/8/4K3/8/8/8/8/R7 w - - 0 1', ['a1a8']);
    expect(picture?.mated).toBe('b');
    const moves = picture!.pieces.map((p) => `${p.type}${p.from}${p.to}`).sort();
    expect(moves).toEqual(['ke6e6', 'ke8e8', 'ra1a8']);
  });

  it('matto in un angolo: la torre e i due re', () => {
    const picture = matePicture('7k/8/6K1/8/8/8/8/R7 w - - 0 1', ['a1a8']);
    const types = picture!.pieces.map((p) => p.type).sort();
    expect(types).toEqual(['k', 'k', 'r']);
  });

  it('non inventa niente se la linea non arriva al matto', () => {
    expect(matePicture('4k3/8/4K3/8/8/8/8/R7 w - - 0 1', ['a1a2'])).toBeNull();
  });

  it('un pedone promosso parte dalla sua casa e arriva come donna', () => {
    const picture = matePicture('4k3/P7/4K3/8/8/8/8/8 w - - 0 1', ['a7a8q']);
    expect(picture!.pieces.find((p) => p.type === 'q')).toMatchObject({ from: 'a7', to: 'a8' });
  });
});
