import { describe, expect, it } from 'vitest';
import { ThinkClock } from './thinkClock.js';

function clock(): { clock: ThinkClock; at: (ms: number) => void } {
  let now = 0;
  return { clock: new ThinkClock(() => now), at: (ms) => (now = ms) };
}

describe("l'orologio del pensiero", () => {
  it('conta il tempo passato sulla posizione', () => {
    const { clock: c, at } = clock();
    c.show('A', true);
    at(5000);
    expect(c.take('A')).toEqual({ ms: 5000, interrupted: false });
  });

  it('non conta il tempo in cui non tocca a chi gioca', () => {
    const { clock: c, at } = clock();
    c.show('A', true);
    at(2000);
    c.show(null, true);
    at(10000);
    c.show('A', true);
    at(11000);
    expect(c.take('A')).toEqual({ ms: 3000, interrupted: false });
  });

  it('una scheda nascosta ferma il conto e segna il turno come interrotto', () => {
    const { clock: c, at } = clock();
    c.show('A', true);
    at(1000);
    c.show('A', false);
    at(60000);
    c.show('A', true);
    at(62000);
    expect(c.take('A')).toEqual({ ms: 3000, interrupted: true });
  });

  it('un turno cominciato prima della pagina e interrotto', () => {
    const { clock: c, at } = clock();
    c.markInterrupted('A');
    c.show('A', true);
    at(4000);
    expect(c.take('A')).toEqual({ ms: 4000, interrupted: true });
  });

  it('guardare una posizione passata conta per quella, non per il turno in corso', () => {
    const { clock: c, at } = clock();
    c.show('A', true);
    at(1000);
    c.show('B', true);
    at(4000);
    c.show('A', true);
    at(5000);
    expect(c.take('A')).toEqual({ ms: 2000, interrupted: false });
    expect(c.take('B')).toEqual({ ms: 3000, interrupted: false });
  });

  it('il tempo si prende una volta sola, e reset cancella tutto', () => {
    const { clock: c, at } = clock();
    c.show('A', true);
    at(1000);
    expect(c.take('A')).not.toBeNull();
    expect(c.take('A')).toBeNull();
    c.show('B', true);
    c.reset();
    at(9000);
    expect(c.take('B')).toBeNull();
  });
});
