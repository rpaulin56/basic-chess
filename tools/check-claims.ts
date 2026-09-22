/**
 * Banco di prova delle affermazioni del racconto sul materiale.
 *
 * Per ogni mossa di chi gioca, in partite vere, rifa' il conto ("ci potevi rimettere una
 * Torre", "c'era un Cavallo da prendere") due volte: con la mossa migliore trovata alla
 * profondita' usata in partita e con quella trovata a una profondita' molto maggiore. Un
 * fatto vero non cambia fra le due.
 *
 * Nato dal piano "dire meno, mostrare meglio" (settembre 2026). Sulle prime quattro
 * partite il vecchio conto, fatto sulla coda di una variante del motore, sbagliava dodici
 * affermazioni su quattordici; il conto statico (vedi materialFact) nessuna su quattro.
 *
 * Uso: npx tsx tools/check-claims.ts <cartella con file .pgn> [profondita' partita] [profondita' verifica]
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { materialFact, type MaterialFact } from '../src/tutor/materialFact.ts';

const [dir = '.', shallowArg = '14', deepArg = '20'] = process.argv.slice(2);
const SHALLOW = Number(shallowArg);
const DEEP = Number(deepArg);

const engine = spawn('node', [join(import.meta.dirname, '..', 'node_modules', 'stockfish', 'scripts', 'cli.js')]);
let buffer = '';
let waiting: ((output: string) => void) | null = null;
engine.stdout.on('data', (chunk: Buffer) => {
  buffer += chunk.toString();
  if (waiting && buffer.includes('bestmove')) {
    const done = waiting;
    waiting = null;
    const output = buffer;
    buffer = '';
    done(output);
  }
});

/** La mossa migliore, in UCI, alla profondita' data. */
function bestMove(fen: string, depth: number): Promise<string | null> {
  return new Promise((resolve) => {
    waiting = (output) => resolve(output.match(/bestmove (\S+)/)?.[1] ?? null);
    engine.stdin.write(`position fen ${fen}\ngo depth ${depth}\n`);
  });
}

function sanOf(fen: string, uci: string | null): string {
  if (!uci) return '?';
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}) }).san;
  } catch {
    return '?';
  }
}

function describe(fact: MaterialFact | null): string {
  return fact ? `${fact.kind === 'lost' ? 'perde' : 'sfugge'} ${fact.piece} (${fact.move})` : '-';
}

let facts = 0;
let unstable = 0;
for (const file of readdirSync(dir).filter((name) => name.endsWith('.pgn'))) {
  const text = readFileSync(join(dir, file), 'utf8');
  const chess = new Chess();
  chess.loadPgn(text);
  const you = /\[White "You"\]/.test(text) ? 'w' : 'b';
  const history = chess.history({ verbose: true });
  console.log(`\n== ${file} (giochi col ${you === 'w' ? 'Bianco' : 'Nero'}, ${history.length} semi-mosse)`);
  for (const [index, move] of history.entries()) {
    if (move.color !== you) continue;
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    const shallowBest = await bestMove(move.before, SHALLOW);
    const deepBest = await bestMove(move.before, DEEP);
    const shallow = describe(materialFact(move.before, uci, shallowBest));
    const deep = describe(materialFact(move.before, uci, deepBest));
    if (shallow === '-' && deep === '-') continue;
    facts++;
    const stable = shallow === deep;
    if (!stable) unstable++;
    const number = Math.floor(index / 2) + 1;
    console.log(
      `${stable ? 'OK   ' : 'CADE '} ${number}${move.color === 'w' ? '.' : '...'}${move.san}` +
        `  a ${SHALLOW}: ${shallow} [meglio ${sanOf(move.before, shallowBest)}]` +
        `  a ${DEEP}: ${deep} [meglio ${sanOf(move.before, deepBest)}]`,
    );
  }
}
console.log(`\nMosse con un fatto sul materiale: ${facts}, di cui ${unstable} cambiano fra ${SHALLOW} e ${DEEP}`);
engine.stdin.write('quit\n');
