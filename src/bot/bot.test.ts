import { describe, expect, it } from 'vitest';
import { distractionById, levelById, selectBotMove } from './bot.js';
import type { Analysis, EngineLine } from '../engine/types.js';

/**
 * La scelta della mossa si collauda su analisi costruite a mano: quello che va
 * verificato non e' che Stockfish valuti bene, ma come reagiamo noi ai suoi numeri.
 */

function line(cp: number, move: string, multipv: number): EngineLine {
  return { multipv, scoreCp: cp, mateIn: null, pv: [move] };
}

function mate(mateIn: number, move: string, multipv: number): EngineLine {
  return { multipv, scoreCp: null, mateIn, pv: [move] };
}

function analysis(lines: EngineLine[]): Analysis {
  return { fen: '', depth: 8, lines, bestMove: lines[0]?.pv[0] ?? null };
}

/** Generatore deterministico: niente sorprese e niente test che passano a giorni alterni. */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length]!;
}

/** L'avversario che non fa papere: i test qui sotto misurano la SCELTA, non i dadi. */
const ATTENTO = distractionById('attento');

describe('selectBotMove', () => {
  const club = levelById('club');

  it('prende la donna in presa anche quando sta gia\' stravincendo', () => {
    // Regressione su un difetto visto in partita: a +10 tutte le mosse valgono ~100%
    // di aspettativa, e fra +18 e +10 — una donna intera — l'aspettativa distingue
    // 2,3 punti. Con il solo criterio in aspettativa il bot sorteggiava, e capitava
    // che lasciasse li' la donna avversaria.
    const winning = analysis([
      line(1800, 'd1h5', 1), // prende la donna
      line(1000, 'a2a3', 2), // mossa d'attesa
      line(980, 'h2h3', 3),
    ]);
    // Con qualunque estrazione che non sia la papera deliberata deve prendere.
    for (const draw of [0.2, 0.5, 0.8, 0.99]) {
      expect(selectBotMove(winning, club, ATTENTO, sequence([0.9, draw]))).toBe('d1h5');
    }
  });

  it('non gioca a caso nemmeno quando sta perdendo malamente', () => {
    const losing = analysis([
      line(-1000, 'g1h1', 1),
      line(-1800, 'd8d1', 2), // regala la donna
      line(-1900, 'a7a6', 3),
    ]);
    for (const draw of [0.2, 0.5, 0.8, 0.99]) {
      expect(selectBotMove(losing, club, ATTENTO, sequence([0.9, draw]))).toBe('g1h1');
    }
  });

  it('preferisce il matto piu\' corto', () => {
    // Senza la valutazione "estesa" tutti i matti valgono 100% e si equivalgono.
    const mating = analysis([mate(1, 'h5f7', 1), mate(6, 'd1d8', 2), line(900, 'a2a3', 3)]);
    expect(selectBotMove(mating, club, ATTENTO, sequence([0.9, 0.99]))).toBe('h5f7');
  });

  it('in posizione equilibrata continua a variare', () => {
    // La correzione non deve trasformare il bot in un motore: quando le mosse sono
    // vicine deve ancora scegliere fra loro, altrimenti sparisce la ragione stessa
    // per cui esiste questo modulo.
    const balanced = analysis([line(20, 'e2e4', 1), line(10, 'd2d4', 2), line(0, 'g1f3', 3)]);
    const chosen = new Set<string>();
    for (const draw of [0.05, 0.3, 0.55, 0.8, 0.97]) {
      chosen.add(selectBotMove(balanced, club, ATTENTO, sequence([0.9, draw]))!);
    }
    expect(chosen.size).toBeGreaterThan(1);
  });
});
