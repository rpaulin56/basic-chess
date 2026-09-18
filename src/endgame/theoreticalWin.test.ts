import { describe, expect, it } from 'vitest';
import { matingTarget, theoreticalDraw, theoreticalWin } from './endgame.js';

describe('theoreticalWin', () => {
  it('riconosce alfiere e cavallo e il colore dell\'angolo', () => {
    // Alfiere in a4: casa chiara.
    expect(theoreticalWin('8/1k6/8/3K4/B7/8/8/4N3 w - - 10 6')).toEqual({ winner: 'w', target: 'light' });
    // Alfiere in c1: casa scura.
    expect(theoreticalWin('7k/8/5K2/8/3N4/8/8/2B5 w - - 0 1')).toEqual({ winner: 'w', target: 'dark' });
  });

  it('donna e torre sul bordo, anche per il Nero', () => {
    expect(theoreticalWin('8/8/8/4k3/8/8/8/K6Q w - - 0 1')).toEqual({ winner: 'w', target: 'edge' });
    expect(theoreticalWin('8/8/8/4K3/8/8/8/k6r b - - 0 1')).toEqual({ winner: 'b', target: 'edge' });
  });

  it('non dichiara vinto quello che non lo e\'', () => {
    // Due cavalli: non si forza il matto.
    expect(theoreticalWin('8/8/8/4k3/8/8/8/K5NN w - - 0 1')).toBeNull();
    // Due alfieri dello stesso colore.
    expect(theoreticalWin('8/8/8/4k3/8/8/8/K3B1B1 w - - 0 1')).toBeNull();
    // Il re debole ha ancora un pedone.
    expect(theoreticalWin('8/8/8/4k3/4p3/8/8/K6Q w - - 0 1')).toBeNull();
  });
});

describe('matingTarget', () => {
  it('l\'angolo giusto piu\' vicino per alfiere e cavallo', () => {
    expect(matingTarget('b7', 'light')).toBe('a8');
    expect(matingTarget('g7', 'dark')).toBe('h8');
  });

  it('il bordo piu\' vicino per donna e torre', () => {
    expect(matingTarget('e5', 'edge')).toBe('h5');
    expect(matingTarget('c7', 'edge')).toBe('c8');
  });
});

describe('theoreticalDraw', () => {
  it('riconosce i finali patti senza pedoni', () => {
    expect(theoreticalDraw('8/8/4k3/8/8/4K3/8/5NN1 w - - 0 1')).toBe('knights');
    expect(theoreticalDraw('8/8/4k3/8/8/4K3/r7/R7 w - - 0 1')).toBe('rook');
    expect(theoreticalDraw('8/5b2/4k3/8/8/4K3/8/5N2 w - - 0 1')).toBe('minor');
    expect(theoreticalDraw('3q4/8/4k3/8/8/4K3/8/3Q4 w - - 0 1')).toBe('queen');
  });

  it('non dichiara patta quello che non lo e\'', () => {
    // Con un pedone la teoria cambia.
    expect(theoreticalDraw('8/8/4k3/8/8/4K3/r6P/R7 w - - 0 1')).toBeNull();
    // Torre contro Alfiere: spesso patta, ma non sempre.
    expect(theoreticalDraw('8/5b2/4k3/8/8/4K3/8/R7 w - - 0 1')).toBeNull();
  });
});
