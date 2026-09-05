import { describe, expect, it } from 'vitest';
import { detectMistake, isImportant, DEFAULT_OPTIONS } from './detect.js';
import type { Analysis, EngineLine } from '../engine/types.js';

/**
 * Il tutor si collauda su analisi COSTRUITE A MANO, non sul motore vero.
 *
 * Non e' una scorciatoia: cosi' ogni caso limite (posizione gia' persa, mossa forzata,
 * matto, analisi superficiale) e' riproducibile esattamente e il test resta veloce.
 * Che Stockfish sappia valutare una posizione lo diamo per assodato; quello che va
 * verificato e' COME reagiamo noi ai suoi numeri.
 */

function line(cp: number, pv = ['e2e4'], multipv = 1): EngineLine {
  return { multipv, scoreCp: cp, mateIn: null, pv };
}

function mateLine(mateIn: number, pv = ['e2e4'], multipv = 1): EngineLine {
  return { multipv, scoreCp: null, mateIn, pv };
}

function analysis(lines: EngineLine[], depth = 14): Analysis {
  return { fen: '', depth, lines, bestMove: lines[0]?.pv[0] ?? null };
}

describe('detectMistake', () => {
  it('non segnala nulla quando la mossa e\' quasi la migliore', () => {
    const before = analysis([line(30), line(20, ['d2d4'], 2), line(10, ['g1f3'], 3)]);
    // Dopo la mossa il tratto passa all'avversario: -25 per lui = +25 per noi.
    const after = analysis([line(-25)]);
    const verdict = detectMistake(before, after);
    expect(verdict.severity).toBe('none');
    expect(verdict.skipped).toBe('tooSmall');
  });

  it('segnala un errore grave quando si passa da vinta a persa', () => {
    const before = analysis([line(600), line(550, ['d2d4'], 2), line(500, ['g1f3'], 3)]);
    const after = analysis([line(600)]); // ora e' l'avversario a stare +6
    const verdict = detectMistake(before, after);
    expect(verdict.severity).toBe('blunder');
    expect(verdict.crossing).toBe('winToLoss');
    expect(isImportant(verdict)).toBe(true);
    expect(verdict.drop).toBeGreaterThan(80);
  });

  it('segnala un errore quando da posizione pari si finisce perdenti', () => {
    const before = analysis([line(20), line(10, ['d2d4'], 2), line(0, ['g1f3'], 3)]);
    const after = analysis([line(300)]);
    const verdict = detectMistake(before, after);
    expect(verdict.crossing).toBe('drawToLoss');
    expect(isImportant(verdict)).toBe(true);
  });

  it('tace se la posizione era gia\' persa', () => {
    // -8 di svantaggio: da qui non si impara nulla peggiorando ancora.
    const before = analysis([line(-800), line(-850, ['d2d4'], 2)]);
    const after = analysis([line(1500)]);
    expect(detectMistake(before, after).skipped).toBe('alreadyLost');
  });

  it('tace se si vince comunque', () => {
    const before = analysis([line(2000), line(1900, ['d2d4'], 2)]);
    const after = analysis([line(-900)]); // resta ampiamente vinta per noi
    expect(detectMistake(before, after).skipped).toBe('stillWinning');
  });

  it('tace quando si salvava solo con una mossa unica', () => {
    // Solo la prima linea tiene la posizione; tutte le altre perdono come la mossa
    // giocata. Trovare l'unica mossa non e' cio' che si chiede a un principiante.
    const before = analysis([line(20), line(-600, ['d2d4'], 2), line(-650, ['g1f3'], 3)]);
    const after = analysis([line(600)]);
    const verdict = detectMistake(before, after);
    expect(verdict.drop).toBeGreaterThan(30);
    expect(verdict.betterAlternatives).toBe(1);
    expect(verdict.skipped).toBe('onlyMove');
  });

  it('segnala l’errore quando più mosse tenevano la posizione', () => {
    // Stessa caduta del caso precedente, ma con tre mosse che salvavano: qui il
    // rimprovero e' meritato. E' il confronto che distingue i due casi.
    const before = analysis([line(20), line(10, ['d2d4'], 2), line(0, ['g1f3'], 3)]);
    const after = analysis([line(600)]);
    const verdict = detectMistake(before, after);
    expect(verdict.betterAlternatives).toBe(3);
    expect(isImportant(verdict)).toBe(true);
  });

  it('tace se l\'analisi e\' troppo superficiale per fidarsi', () => {
    const before = analysis([line(600), line(550, ['d2d4'], 2)], 4);
    const after = analysis([line(600)], 4);
    expect(detectMistake(before, after).skipped).toBe('shallow');
  });

  it('NON segnala un matto mancato che si vedeva con una sola mossa', () => {
    // Avevamo il matto in 3, ma solo con quella mossa: tutte le altre lasciano la
    // posizione pari. E' una scelta deliberata del tutor, non una svista: chiedere a
    // un principiante di trovare l'unica mossa che matta lo demoralizza e basta.
    // Il prezzo da pagare e' che qualche occasione persa passa sotto silenzio.
    const before = analysis([mateLine(3), line(50, ['d2d4'], 2), line(20, ['g1f3'], 3)]);
    const after = analysis([line(0)]);
    const verdict = detectMistake(before, after);
    expect(verdict.winPercentBefore).toBe(100);
    expect(verdict.skipped).toBe('onlyMove');
  });

  it('segnala un matto mancato quando si vinceva in piu’ modi', () => {
    // Qui il matto era una delle tre strade vincenti: non trovarne nessuna e’ un errore.
    const before = analysis([mateLine(3), mateLine(5, ['d2d4'], 2), line(900, ['g1f3'], 3)]);
    const after = analysis([line(0)]);
    const verdict = detectMistake(before, after);
    expect(verdict.betterAlternatives).toBe(3);
    expect(verdict.severity).toBe('blunder');
    expect(verdict.crossing).toBe('winToDraw');
  });

  it('riconosce il matto subito come errore grave', () => {
    const before = analysis([line(0), line(-20, ['d2d4'], 2), line(-40, ['g1f3'], 3)]);
    const after = analysis([mateLine(2)]); // l'avversario ha matto in 2
    const verdict = detectMistake(before, after);
    expect(verdict.winPercentAfter).toBe(0);
    expect(verdict.severity).toBe('blunder');
    expect(verdict.crossing).toBe('drawToLoss');
  });

  it('conta correttamente quante alternative erano migliori', () => {
    const before = analysis([line(100), line(90, ['d2d4'], 2), line(-200, ['g1f3'], 3)]);
    const after = analysis([line(200)]); // dopo la mossa siamo a -2
    const verdict = detectMistake(before, after, { ...DEFAULT_OPTIONS, minDepth: 1 });
    // Le prime due linee erano nettamente migliori, la terza no.
    expect(verdict.betterAlternatives).toBe(2);
  });
});
