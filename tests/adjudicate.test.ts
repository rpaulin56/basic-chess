import { describe, expect, it } from 'vitest';
import { acceptsDraw, judgeDraw, judgeResign } from '../src/tutor/adjudicate.js';

describe('judgeResign', () => {
  it('dice di no finche\' c\'e\' partita', () => {
    expect(judgeResign(85)).toBe('winning');
    expect(judgeResign(50)).toBe('balanced');
    expect(judgeResign(25)).toBe('worse');
  });

  it('dice di si\' solo quando non c\'e\' piu\' niente da fare', () => {
    expect(judgeResign(11)).toBe('hopeless');
    expect(judgeResign(0)).toBe('hopeless');
  });

  it('usa la stessa soglia con cui il tutor smette di parlare', () => {
    // A 12 la partita e' ancora viva, a 11.9 no: se le due soglie divergessero, il
    // tutor tacerebbe perche' e' finita e insieme direbbe che c'e' da giocare.
    expect(judgeResign(12)).toBe('worse');
    expect(judgeResign(11.9)).toBe('hopeless');
  });
});

describe('judgeDraw', () => {
  it('rifiuta l\'offerta in apertura, qualunque sia la posizione', () => {
    expect(judgeDraw(50, 8)).toBe('tooEarly');
    expect(judgeDraw(5, 8)).toBe('tooEarly');
    expect(judgeDraw(95, 19)).toBe('tooEarly');
    expect(judgeDraw(50, 20)).toBe('balanced');
  });

  it('distingue le quattro situazioni dopo l\'apertura', () => {
    expect(judgeDraw(80, 30)).toBe('winning');
    expect(judgeDraw(50, 30)).toBe('balanced');
    expect(judgeDraw(25, 30)).toBe('worse');
    expect(judgeDraw(4, 30)).toBe('hopeless');
  });
});

describe('acceptsDraw', () => {
  it('accetta se non si sente meglio, rifiuta se si sente meglio', () => {
    expect(acceptsDraw(50)).toBe(true);
    expect(acceptsDraw(20)).toBe(true);
    expect(acceptsDraw(75)).toBe(false);
  });
});
