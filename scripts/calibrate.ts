/**
 * Calibrazione della forza del bot.
 *
 * Il punto: "livello 1000 Elo" deve essere un numero MISURATO, non sperato. I valori
 * in BOT_LEVELS sono ipotesi; questo script le verifica facendo giocare il bot contro
 * un avversario di forza nota e ricavando l'Elo dal punteggio.
 *
 * L'ancoraggio e' Stockfish con UCI_LimitStrength + UCI_Elo: e' l'unico riferimento a
 * una scala Elo esterna disponibile offline. Non e' un riferimento perfetto (sotto i
 * ~1320 Stockfish non scende, e la sua taratura e' essa stessa approssimativa), ma
 * serve a rispondere alla domanda che conta: "questo livello e' MOLTO piu' forte del
 * minimo di Stockfish, o comparabile, o piu' debole?".
 *
 *   npm run calibrate -- --level l2 --anchor 1320 --games 20
 *   npm run calibrate -- --level l3 --vs l2 --games 20          (confronto interno)
 *   npm run calibrate -- --level l2 --depth 3 --temp 30 --maxcost 20
 *     (i parametri si possono forzare da riga di comando: serve a cercare una taratura
 *      NUOVA senza dover modificare BOT_LEVELS ad ogni tentativo)
 *   npm run calibrate -- --level l2 --book off                  (senza spinta teorica)
 *
 * Il bot in prova gioca ESATTAMENTE come nell'applicazione, spinta della teoria compresa
 * (vedi BOOK_PULL in bot.ts): misurare un bot senza libro darebbe l'Elo di un giocatore
 * che non esiste. L'ancoraggio invece e' Stockfish nudo, che e' il metro.
 */

import { readFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { createEngine } from '../src/engine/uci.js';
import type { Engine } from '../src/engine/types.js';
import { BOT_LEVELS, distractionById, eloText, levelById, type BotLevel } from '../src/bot/bot.js';
import { chooseBotMove } from '../src/bot/play.js';
import { createNodeTransport } from './nodeTransport.js';

// --- argomenti ------------------------------------------------------------

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const levelId = arg('level', 'l2');
const opponentId = arg('vs', '');
const anchorElo = Number(arg('anchor', '1320'));
const games = Number(arg('games', '20'));
const maxPlies = Number(arg('maxPlies', '250'));
const distraction = distractionById(arg('distraction', 'attento'));

const useBook = arg('book', 'on') !== 'off';

/**
 * Il libro delle aperture, letto dal file che l'applicazione serve al browser.
 *
 * Serve a dare al bot in prova la stessa spinta verso la teoria che ha in partita. Se il
 * file non c'e' si misura senza: il libro e' un di piu', e lo dice anche il codice del
 * gioco.
 */
const bookTable: Record<string, [string, number][]> = useBook
  ? await readFile(new URL('../public/book.json', import.meta.url), 'utf8')
      .then((text) => JSON.parse(text) as Record<string, [string, number][]>)
      .catch(() => ({}))
  : {};

function bookShares(fen: string): (uci: string) => number {
  const entry = bookTable[fen.split(' ').slice(0, 3).join(' ')];
  if (!entry) return () => 0;
  const shares = new Map<string, number>();
  for (const [san, share] of entry) {
    try {
      const move = new Chess(fen).move(san);
      shares.set(`${move.from}${move.to}${move.promotion ?? ''}`, share);
    } catch {
      // Mossa che qui non si puo' giocare: il libro non parla di questa posizione.
    }
  }
  return (uci) => shares.get(uci) ?? 0;
}

// --- giocatori ------------------------------------------------------------

type Player = {
  readonly name: string;
  move(fen: string): Promise<string | null>;
  quit(): void;
};

async function botPlayer(level: BotLevel, seed: number): Promise<Player> {
  const engine = await createEngine(createNodeTransport(), { hashMb: 32 });
  // Generatore riproducibile (xorshift): due esecuzioni con lo stesso seed danno le
  // stesse partite, altrimenti confrontare due tarature diverse non significa nulla.
  let s = seed || 1;
  const rng = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
  return {
    name: `bot:${level.id}`,
    // La stessa strada che usa l'applicazione, ricerca compresa: misurare un bot
    // diverso da quello che gioca davvero darebbe numeri di Elo di un giocatore
    // immaginario.
    async move(fen) {
      return chooseBotMove(
        (options) => engine.analyse(fen, options),
        level,
        distraction,
        rng,
        bookShares(fen),
      );
    },
    quit: () => engine.quit(),
  };
}

async function anchorPlayer(elo: number): Promise<Player> {
  const engine: Engine = await createEngine(createNodeTransport(), {
    hashMb: 32,
    uci: { UCI_LimitStrength: 'true', UCI_Elo: elo },
  });
  return {
    name: `stockfish:${elo}`,
    async move(fen) {
      const analysis = await engine.analyse(fen, { depth: 8, multiPV: 1 });
      return analysis.bestMove;
    },
    quit: () => engine.quit(),
  };
}

// --- partita --------------------------------------------------------------

type Outcome = 1 | 0 | 0.5;

async function playGame(white: Player, black: Player): Promise<{ result: Outcome; plies: number; reason: string }> {
  const chess = new Chess();
  while (!chess.isGameOver() && chess.history().length < maxPlies) {
    const player = chess.turn() === 'w' ? white : black;
    const uci = await player.move(chess.fen());
    if (!uci) break;
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined });
    } catch {
      // Non dovrebbe succedere: se succede e' un bug, e va visto subito invece di
      // essere assorbito in una statistica.
      throw new Error(`Mossa illegale da ${player.name}: ${uci} nella posizione ${chess.fen()}`);
    }
  }
  const plies = chess.history().length;
  if (chess.isCheckmate()) {
    return { result: chess.turn() === 'w' ? 0 : 1, plies, reason: 'matto' };
  }
  if (chess.isGameOver()) return { result: 0.5, plies, reason: 'patta' };
  return { result: 0.5, plies, reason: 'troncata' };
}

/** Differenza Elo implicata da un punteggio su N partite. */
function eloDiff(score: number, total: number): number {
  const p = Math.min(Math.max(score / total, 0.001), 0.999);
  return -400 * Math.log10(1 / p - 1);
}

// --- esecuzione -----------------------------------------------------------

// Override da riga di comando: la ricerca di una taratura e' un ciclo "prova, misura,
// correggi", e farlo modificando il sorgente ad ogni giro e' lento e si presta a
// confrontare per sbaglio due versioni diverse del codice.
const base = levelById(levelId);
const level: BotLevel = {
  ...base,
  depth: Number(arg('depth', String(base.depth))),
  multiPV: Number(arg('multipv', String(base.multiPV))),
  temperature: Number(arg('temp', String(base.temperature))),
  decidedPawns: Number(arg('decided', String(base.decidedPawns ?? 3))),
  maxCost: Number(arg('maxcost', String(base.maxCost ?? 15))),
};

/** Il dichiarato e' un INTERVALLO, e dipende anche dall'attenzione: vedi eloText. */
const declared = eloText(level, distraction.id as 'attento' | 'distratto');
const opponentLevel = opponentId ? levelById(opponentId) : null;

console.log(
  `Livello in prova: ${level.id} ${distraction.id} (Elo dichiarato ${declared}, ` +
    `depth ${level.depth}, MultiPV ${level.multiPV}, T=${level.temperature}, ` +
    `tetto ${level.maxCost}, papere ${(distraction.blunderRate * 100).toFixed(1)}%)`,
);
console.log(useBook ? 'Con la spinta della teoria.' : 'SENZA la spinta della teoria.');
console.log(opponentLevel ? `Avversario: bot ${opponentLevel.id}` : `Avversario: Stockfish limitato a ${anchorElo} Elo`);
console.log(`Partite: ${games} (colori alternati)\n`);

const subject = await botPlayer(level, 12345);
const opponent = opponentLevel ? await botPlayer(opponentLevel, 67890) : await anchorPlayer(anchorElo);

let score = 0;
let wins = 0;
let draws = 0;
let losses = 0;
const started = Date.now();

for (let i = 0; i < games; i++) {
  // Colori alternati: giocare sempre con lo stesso colore introdurrebbe il vantaggio
  // del tratto nella misura, che e' proprio cio' che non vogliamo misurare.
  const subjectIsWhite = i % 2 === 0;
  const { result, plies, reason } = subjectIsWhite
    ? await playGame(subject, opponent)
    : await playGame(opponent, subject);
  const subjectScore: Outcome = subjectIsWhite ? result : ((1 - result) as Outcome);
  score += subjectScore;
  if (subjectScore === 1) wins++;
  else if (subjectScore === 0.5) draws++;
  else losses++;
  console.log(
    `  ${String(i + 1).padStart(3)}: ${subjectIsWhite ? 'bianco' : ' nero '} ` +
      `${subjectScore === 1 ? 'vinta' : subjectScore === 0 ? 'persa' : 'patta'} ` +
      `(${plies} semi-mosse, ${reason})`,
  );
}

subject.quit();
opponent.quit();

const percent = (score / games) * 100;
const diff = eloDiff(score, games);
// Errore standard del punteggio -> incertezza sulla stima. Con 20 partite l'intervallo
// e' largo: dichiararlo evita di prendere per buona una differenza che e' solo rumore.
const stdError = Math.sqrt((percent / 100) * (1 - percent / 100) / games);
const eloMargin = Math.abs(eloDiff(Math.min(score / games + stdError, 0.999) * games, games) - diff);

console.log(`\nRisultato: ${wins}V ${draws}P ${losses}S = ${score}/${games} (${percent.toFixed(1)}%)`);
console.log(`Differenza Elo stimata: ${diff >= 0 ? '+' : ''}${diff.toFixed(0)} ± ${eloMargin.toFixed(0)}`);
if (!opponentLevel) {
  console.log(`Elo stimato del livello "${level.id}": ${(anchorElo + diff).toFixed(0)}`);
  console.log(`(dichiarato in BOT_LEVELS: ${declared})`);
}
console.log(`Tempo: ${((Date.now() - started) / 1000).toFixed(0)}s`);
console.log(`\nLivelli disponibili: ${BOT_LEVELS.map((l) => l.id).join(', ')}`);
