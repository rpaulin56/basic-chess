import { describe, expect, it } from 'vitest';
import { orientPosition } from '../src/tutor/orientation.js';

/**
 * La sicurezza del Re dipende da CHI puo' attaccarlo.
 *
 * Il caso che ha fatto nascere questi test viene da una partita vera: con l'avversaria
 * ridotta a Re, Cavallo e pochi pedoni, il consiglio era "metti il Re al sicuro" — che
 * li' non e' solo inutile, e' il contrario di quello che si deve fare.
 */
describe('orientamento: il Re', () => {
  const keys = (fen: string, color: 'w' | 'b'): string[] =>
    orientPosition(fen, color).map((reason) => reason.key);

  // Re bianco in g1 senza pedoni davanti; la Donna nera e' ancora in gioco.
  const withQueen = '3qk3/pppppppp/8/8/8/8/8/6K1 w - - 0 1';
  // Stessa idea, ma all'avversario resta solo un Cavallo: tre punti, sotto la soglia.
  const endgame = '4k3/8/5n2/8/8/8/5PPP/6K1 w - - 0 1';

  it('con la Donna in gioco, un Re scoperto e il tema', () => {
    expect(keys(withQueen, 'w')).toContain('orientKingExposed');
  });

  it('con il solo Cavallo avversario, non lo e piu', () => {
    expect(keys(endgame, 'w')).not.toContain('orientKingExposed');
  });

  it('e in finale il consiglio si rovescia: il Re va al centro', () => {
    expect(keys(endgame, 'w')).toContain('orientKingActive');
  });

  it('ma non lo dice a chi il Re al centro ce lo ha gia', () => {
    const centred = '4k3/8/5n2/8/4K3/8/5PPP/8 w - - 0 1';
    expect(keys(centred, 'w')).not.toContain('orientKingActive');
  });
});
