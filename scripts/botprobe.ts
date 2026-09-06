/**
 * Perche' il bot ha scelto QUELLA mossa.
 *
 * Prende una partita, si mette in una posizione precisa e stampa esattamente cio' che
 * il bot vede al suo livello: le linee a quella profondita', il costo che il criterio
 * di scelta assegna a ciascuna e la probabilita' con cui verrebbe giocata. Serve a
 * distinguere le due cause possibili di una mossa assurda, che chiedono rimedi
 * opposti: il motore non l'ha vista (profondita' troppo bassa) oppure l'ha vista e il
 * campionamento l'ha scelta lo stesso (temperatura troppo alta).
 *
 *   npm run botprobe -- --pgn partita.pgn --ply 73 --level discreto
 */

import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { parsePgn } from '../src/core/pgn.js';
import { createEngine } from '../src/engine/uci.js';
import { levelById } from '../src/bot/bot.js';
import { winPercentOf } from '../src/engine/winProb.js';
import type { EngineLine } from '../src/engine/types.js';
import { createNodeTransport } from './nodeTransport.js';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const pgnPath = arg('pgn', '');
const level = levelById(arg('level', 'discreto'));
const plies = arg('ply', '')
  .split(',')
  .filter(Boolean)
  .map(Number);

if (!pgnPath || plies.length === 0) {
  console.error('Uso: npm run botprobe -- --pgn <file.pgn> --ply <n[,n...]> [--level <id>]');
  process.exit(1);
}

const { state } = parsePgn(readFileSync(pgnPath, 'utf8'));
const engine = await createEngine(createNodeTransport(), { hashMb: 64 });

// Le stesse costanti del bot. Duplicate di proposito: se qui si copiassero da bot.ts
// una modifica sbagliata laggiu' verrebbe riprodotta identica anche nella diagnosi.
const CP_PER_POINT = 10;
const DECIDED_PAWNS = 3;
const DECIDED_MAX_COST = 5;
const DECIDED_EXTRA_DEPTH = 2;

function extendedCp(line: EngineLine): number {
  if (line.mateIn === null) return line.scoreCp ?? 0;
  return line.mateIn > 0 ? 100_000 - line.mateIn * 100 : -100_000 - line.mateIn * 100;
}

function sanOf(fen: string, uci: string): string {
  const chess = new Chess(fen);
  try {
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
    }).san;
  } catch {
    return uci;
  }
}

for (const ply of plies) {
  const fen = ply === 0 ? state.startFen : state.plies[ply - 1]?.fenAfter;
  if (!fen) {
    console.log(`semi-mossa ${ply}: fuori dalla partita`);
    continue;
  }
  const played = state.plies[ply]?.san ?? '(fine)';
  const shallow = await engine.analyse(fen, { depth: level.depth, multiPV: level.multiPV });
  const bestShallow = shallow?.lines.find((line) => line.pv.length > 0);
  // Come play.ts: se la partita e' decisa il bot ricerca piu' a fondo prima di scegliere.
  const deciding =
    bestShallow !== undefined && Math.abs(extendedCp(bestShallow)) / 100 >= DECIDED_PAWNS;
  const analysis = deciding
    ? await engine.analyse(fen, { depth: level.depth + DECIDED_EXTRA_DEPTH, multiPV: level.multiPV })
    : shallow;
  const deep = await engine.analyse(fen, { depth: 16, multiPV: 1 });
  if (!analysis || analysis.lines.length === 0) {
    console.log(`semi-mossa ${ply}: nessuna linea`);
    continue;
  }
  const best = analysis.lines[0]!;
  const decided = Math.abs(extendedCp(best)) / 100 >= DECIDED_PAWNS;
  const temperature = decided ? level.temperature * 0.4 : level.temperature;

  const kept = decided
    ? analysis.lines.filter(
        (line) =>
          Math.max(
            winPercentOf(best) - winPercentOf(line),
            (extendedCp(best) - extendedCp(line)) / CP_PER_POINT,
          ) <= DECIDED_MAX_COST,
      )
    : analysis.lines;

  const rows = analysis.lines.map((line) => {
    const cost = Math.max(
      0,
      Math.max(
        winPercentOf(best) - winPercentOf(line),
        (extendedCp(best) - extendedCp(line)) / CP_PER_POINT,
      ),
    );
    const scartata = !kept.includes(line);
    return {
      san: sanOf(fen, line.pv[0]!),
      line,
      cost,
      scartata,
      weight: scartata ? 0 : Math.exp(-cost / temperature),
    };
  });
  const total = rows.reduce((sum, row) => sum + row.weight, 0);

  console.log(
    `\nsemi-mossa ${ply} — giocata ${played} — livello ${level.id} (profondita' ${level.depth}, ` +
      `MultiPV ${level.multiPV}, temperatura ${temperature.toFixed(1)}${decided ? `, decisa: profondita' ${level.depth + DECIDED_EXTRA_DEPTH}, niente papere` : ''})`,
  );
  console.log(
    `  a profondita' 16 la posizione vale ${(extendedCp(deep?.lines[0] ?? best) / 100).toFixed(2)}`,
  );
  for (const row of rows) {
    const score =
      row.line.mateIn === null
        ? `${(row.line.scoreCp ?? 0) / 100}`.padStart(7)
        : `M${row.line.mateIn}`.padStart(7);
    console.log(
      `  ${row.san.padEnd(8)} ${score}  costo ${row.cost.toFixed(1).padStart(6)}  ` +
        (row.scartata ? "scartata" : `probabilita' ${((row.weight / total) * 100).toFixed(1).padStart(5)}%`),
    );
  }
}

await engine.quit();
