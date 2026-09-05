/**
 * Diagnostica di una singola posizione: cosa vede il motore e come il tutor la
 * classifica. Serve quando il verdetto sullo schermo non torna e bisogna capire se
 * sbaglia il motore, il rilevatore o il classificatore.
 *
 *   npm run explain -- --fen "<fen dopo la mossa sbagliata>"
 */

import { createEngine } from '../src/engine/uci.js';
import { classifyConsequence } from '../src/tutor/classify.js';
import { createNodeTransport } from './nodeTransport.js';
import { Chess } from 'chess.js';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const fen = arg('fen', '');
const depth = Number(arg('depth', '14'));
const multiPV = Number(arg('multipv', '3'));
if (!fen) {
  console.error('Uso: npm run explain -- --fen "<fen>"');
  process.exit(1);
}

const engine = await createEngine(createNodeTransport(), { hashMb: 64 });
const analysis = await engine.analyse(fen, { depth, multiPV });

for (const line of analysis.lines) {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of line.pv) {
    try {
      san.push(
        chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
        }).san,
      );
    } catch {
      break;
    }
  }
  const score = line.mateIn !== null ? `M${line.mateIn}` : `${(line.scoreCp ?? 0) / 100}`;
  console.log(`  pv${line.multipv} ${score.padStart(6)}  ${san.join(' ')}`);
}

const consequence = classifyConsequence(fen, analysis.lines[0]?.pv ?? []);
console.log('\nclassificazione:', JSON.stringify(consequence, null, 2));
engine.quit();
