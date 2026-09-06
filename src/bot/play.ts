import type { Analysis } from '../engine/types.js';
import { isDecided, selectBotMove, type BotLevel, type Rng } from './bot.js';

/**
 * La mossa del bot, ricerca compresa.
 *
 * Sta qui e non in bot.ts perche' bot.ts e' volutamente puro (nessun motore, quindi
 * verificabile con dei test), e non nell'interfaccia perche' la calibrazione deve
 * misurare ESATTAMENTE il bot che gioca contro l'utente: se le due strade scegliessero
 * le mosse in modo anche solo leggermente diverso, i numeri di Elo misurati sarebbero
 * quelli di un giocatore che non esiste.
 */

/**
 * Di quanto si allunga la ricerca quando la partita e' decisa.
 *
 * Piu' profondita' solo quando serve: e' li' che il bot deve convertire un vantaggio o
 * resistere, ed e' li' che una ricerca corta produce le mosse che fanno sembrare rotto
 * il programma. Costa poco, perche' le posizioni decise sono di solito finali con
 * pochi pezzi. Deviazione dal realismo deliberata: portare a termine una posizione
 * vinta e' fra le cose piu' difficili da imparare, e allenarsi contro un avversario
 * che le butta via non insegna niente.
 */
const DECIDED_EXTRA_DEPTH = 2;

export type Analyse = (options: { depth: number; multiPV: number }) => Promise<Analysis | null>;

export async function chooseBotMove(
  analyse: Analyse,
  level: BotLevel,
  rng?: Rng,
): Promise<string | null> {
  const first = await analyse({ depth: level.depth, multiPV: level.multiPV });
  if (!first) return null;
  if (!isDecided(first, level)) return selectBotMove(first, level, rng);

  const deeper = await analyse({
    depth: level.depth + DECIDED_EXTRA_DEPTH,
    multiPV: level.multiPV,
  });
  return selectBotMove(deeper ?? first, level, rng);
}
