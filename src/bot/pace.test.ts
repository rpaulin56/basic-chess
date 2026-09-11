import { describe, expect, it } from 'vitest';
import { botPauseMs } from './pace.js';

describe('la pausa della Nonna', () => {
  it('aspetta un secondo se ha risposto subito', () => {
    expect(botPauseMs({ obvious: false, elapsedMs: 0 })).toBe(1000);
  });

  it('aspetta mezzo secondo per una mossa ovvia', () => {
    expect(botPauseMs({ obvious: true, elapsedMs: 0 })).toBe(500);
  });

  it('conta il tempo gia' + "'" + ' passato', () => {
    expect(botPauseMs({ obvious: false, elapsedMs: 600 })).toBe(400);
  });

  it('non aspetta niente se ha gia' + "'" + ' impiegato piu' + "'" + ' del minimo', () => {
    expect(botPauseMs({ obvious: false, elapsedMs: 26000 })).toBe(0);
    expect(botPauseMs({ obvious: true, elapsedMs: 700 })).toBe(0);
  });
});
