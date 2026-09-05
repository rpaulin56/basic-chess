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
import { formatScore, winPercentOf } from '../src/engine/winProb.js';
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

/**
 * Statistiche GREZZE, senza i filtri del tutor.
 *
 * Servono a una domanda diversa da quella del tutor: non "cosa vale la pena
 * segnalare" ma "quanto bene ha giocato". I filtri anti-rumore (posizione gia' persa,
 * si vince comunque) sono giusti per non tormentare chi gioca e sbagliati per
 * misurare la forza — in una partita vinta comodamente silenziano quasi tutto.
 */
interface Stats {
  plies: number;
  totalLoss: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
}
/** Fascia in cui la partita e' ancora in gioco, in punti di aspettativa. */
const ALIVE_FROM = 10;
const ALIVE_TO = 90;

const stats: Record<'w' | 'b', Stats> = {
  w: { plies: 0, totalLoss: 0, inaccuracies: 0, mistakes: 0, blunders: 0 },
  b: { plies: 0, totalLoss: 0, inaccuracies: 0, mistakes: 0, blunders: 0 },
};

for (let i = 0; i < state.plies.length; i++) {
  const ply = state.plies[i]!;
  if (side && ply.color !== side) continue;

  const before = await engine.analyse(ply.fenBefore, { depth, multiPV });
  const after = await engine.analyse(ply.fenAfter, { depth, multiPV });

  const bestBefore = before.lines[0];
  const bestAfter = after.lines[0];
  // Si contano solo le mosse giocate mentre la partita era ancora VIVA. Quando
  // l'aspettativa e' a 0 non si puo' perdere di piu': continuare a mediare su una
  // posizione morta abbassa artificialmente la media di chi sta perdendo e fa
  // sembrare bravi tutti. E' l'errore in cui si cade misurando l'accuratezza su
  // partite decise presto.
  if (bestBefore && bestAfter) {
    const winPercent = winPercentOf(bestBefore);
    if (winPercent >= ALIVE_FROM && winPercent <= ALIVE_TO) {
      const loss = Math.max(0, winPercent - (100 - winPercentOf(bestAfter)));
      const entry = stats[ply.color];
      entry.plies++;
      entry.totalLoss += loss;
      if (loss >= 30) entry.blunders++;
      else if (loss >= 18) entry.mistakes++;
      else if (loss >= 10) entry.inaccuracies++;
    }
  }

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

for (const color of ['w', 'b'] as const) {
  const entry = stats[color];
  if (entry.plies === 0) continue;
  const average = entry.totalLoss / entry.plies;
  console.log('');
  console.log(
    `${color === 'w' ? 'Bianco' : 'Nero'}: ${entry.plies} mosse a partita aperta, ` +
      `perdita media ${average.toFixed(1)} punti di aspettativa per mossa`,
  );
  console.log(
    `  gravi ${entry.blunders}, errori ${entry.mistakes}, imprecisioni ${entry.inaccuracies} ` +
      `(conteggio GREZZO, senza i filtri del tutor)`,
  );
}

engine.quit();
