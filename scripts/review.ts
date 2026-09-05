/**
 * Passa in rassegna una partita intera con il tutor, dalla riga di comando.
 *
 * Serve a due cose: capire perche' il tutor ha detto quello che ha detto su una
 * partita reale, e tarare le soglie su partite vere invece che su casi inventati.
 * Usa esattamente lo stesso detect.ts dell'applicazione.
 *
 *   npm run review -- --pgn partita.pgn
 *   npm run review -- --pgn partita.pgn --side b --all
 *
 * --side  limita il giudizio alle mosse di un colore (per default entrambi)
 * --all   mostra anche le mosse promosse, con il motivo del silenzio
 */

import { readFileSync } from 'node:fs';
import { parsePgn } from '../src/core/pgn.js';
import { createEngine } from '../src/engine/uci.js';
import { detectMistake } from '../src/tutor/detect.js';
import { moveNumberOf, positionAt } from '../src/core/game.js';
import { formatScore } from '../src/engine/winProb.js';
import { createNodeTransport } from './nodeTransport.js';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const pgnPath = arg('pgn', '');
const side = arg('side', '');
const showAll = process.argv.includes('--all');
const depth = Number(arg('depth', '14'));
const multiPV = Number(arg('multipv', '3'));

if (!pgnPath) {
  console.error('Uso: npm run review -- --pgn <file.pgn> [--side w|b] [--all]');
  process.exit(1);
}

const { state } = parsePgn(readFileSync(pgnPath, 'utf8'));
const engine = await createEngine(createNodeTransport(), { hashMb: 64 });

console.log(`${state.plies.length} semi-mosse, analisi a profondita' ${depth}, MultiPV ${multiPV}\n`);

for (let i = 0; i < state.plies.length; i++) {
  const ply = state.plies[i]!;
  if (side && ply.color !== side) continue;

  const before = await engine.analyse(ply.fenBefore, { depth, multiPV });
  const after = await engine.analyse(ply.fenAfter, { depth, multiPV });
  const verdict = detectMistake(before, after);

  const number = moveNumberOf(state, i);
  const label = `${number}${ply.color === 'w' ? '.' : '...'} ${ply.san}`;
  const evaluation = before.lines[0] ? formatScore(before.lines[0], ply.color) : '?';

  if (verdict.severity === 'none') {
    if (showAll) {
      console.log(`  ${label.padEnd(12)} ${evaluation.padStart(7)}  —  (${verdict.skipped})`);
    }
    continue;
  }

  console.log(`\n${label}  ${verdict.severity.toUpperCase()}`);
  console.log(`  probabilita' di vittoria: ${verdict.winPercentBefore.toFixed(0)}% -> ${verdict.winPercentAfter.toFixed(0)}% (${verdict.drop.toFixed(0)} punti persi)`);
  if (verdict.crossing) console.log(`  cambio di genere: ${verdict.crossing}`);
  console.log(`  alternative che tenevano: ${verdict.betterAlternatives}`);

  // La mossa migliore e il seguito previsto, tradotti in SAN: e' l'informazione che
  // la fase 4 dovra' trasformare in un diagramma con le frecce.
  const chess = positionAt(state, i);
  const sans: string[] = [];
  for (const uci of verdict.bestLine.slice(0, 8)) {
    try {
      sans.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}) }).san);
    } catch {
      break;
    }
  }
  console.log(`  invece di ${ply.san}: ${sans.join(' ')}`);

  // Il seguito che il motore prevede DOPO la mossa giocata: e' la confutazione, cioe'
  // la risposta alla domanda "perche' e' un errore".
  const punished = positionAt(state, i + 1);
  const punishment: string[] = [];
  for (const uci of after.lines[0]?.pv.slice(0, 8) ?? []) {
    try {
      punishment.push(punished.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}) }).san);
    } catch {
      break;
    }
  }
  console.log(`  confutazione: ${punishment.join(' ')}`);
}

engine.quit();
