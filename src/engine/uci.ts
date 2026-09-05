import type { Analysis, AnalyseOptions, Engine, EngineLine, UciTransport } from './types.js';

/**
 * Dialogo UCI: l'unico punto del programma che sa come si parla a un motore.
 *
 * Sopra questo livello si vedono solo posizioni e valutazioni (vedi types.ts).
 */

/** Estrae una linea `info ...` utile. Restituisce null per le righe che non servono. */
export function parseInfoLine(line: string): EngineLine | (EngineLine & { depth: number }) | null {
  if (!line.startsWith('info ')) return null;
  // Le righe di solo avanzamento ("info depth 1 currmove ...") non portano valutazione.
  if (!line.includes(' score ') || !line.includes(' pv ')) return null;

  const tokens = line.split(/\s+/);
  const readNumber = (key: string): number | null => {
    const index = tokens.indexOf(key);
    if (index === -1) return null;
    const value = Number(tokens[index + 1]);
    return Number.isFinite(value) ? value : null;
  };

  const depth = readNumber('depth');
  if (depth === null) return null;

  const scoreIndex = tokens.indexOf('score');
  const scoreKind = tokens[scoreIndex + 1];
  const scoreValue = Number(tokens[scoreIndex + 2]);
  if (!Number.isFinite(scoreValue)) return null;

  const pvIndex = tokens.indexOf('pv');
  const pv = tokens.slice(pvIndex + 1).filter((token) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token));
  if (pv.length === 0) return null;

  return {
    multipv: readNumber('multipv') ?? 1,
    depth,
    scoreCp: scoreKind === 'cp' ? scoreValue : null,
    mateIn: scoreKind === 'mate' ? scoreValue : null,
    pv,
  };
}

/**
 * Crea un motore sopra un canale qualsiasi.
 *
 * Serializza le richieste: UCI e' un protocollo a singola conversazione, due `go`
 * sovrapposti producono risposte indistinguibili. Una richiesta nuova manda `stop`
 * a quella in corso e si mette in coda; se ne arriva una terza mentre si aspetta,
 * la seconda viene scartata (chi analizza vuole l'ULTIMA posizione, non tutte).
 */
export async function createEngine(
  transport: UciTransport,
  options: {
    readonly threads?: number;
    readonly hashMb?: number;
    /**
     * Opzioni UCI aggiuntive. Le usa lo script di calibrazione per creare
     * l'avversario di riferimento (UCI_LimitStrength + UCI_Elo): e' l'unico ancoraggio
     * a una scala Elo esterna che abbiamo a disposizione.
     */
    readonly uci?: Readonly<Record<string, string | number | boolean>>;
  } = {},
): Promise<Engine> {
  let onLineHandler: ((line: string) => void) | null = null;
  transport.onLine((line) => onLineHandler?.(line));

  /** Aspetta una riga che soddisfi il predicato, raccogliendo tutto nel frattempo. */
  function collectUntil(
    done: (line: string) => boolean,
    onEach?: (line: string) => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      onLineHandler = (line) => {
        onEach?.(line);
        if (done(line)) {
          onLineHandler = null;
          resolve();
        }
      };
    });
  }

  transport.send('uci');
  await collectUntil((line) => line.startsWith('uciok'));

  if (options.threads && options.threads > 1) {
    transport.send(`setoption name Threads value ${options.threads}`);
  }
  if (options.hashMb) transport.send(`setoption name Hash value ${options.hashMb}`);
  for (const [name, value] of Object.entries(options.uci ?? {})) {
    transport.send(`setoption name ${name} value ${value}`);
  }
  transport.send('isready');
  await collectUntil((line) => line.startsWith('readyok'));

  let running: Promise<unknown> = Promise.resolve();
  let pending = 0;
  let currentMultiPV = -1;

  async function analyse(fen: string, request: AnalyseOptions): Promise<Analysis> {
    pending++;
    if (pending > 1) transport.send('stop'); // sveglia l'analisi in corso: la vogliamo abbandonare
    const mine = running.then(() => run(fen, request));
    running = mine.catch(() => undefined);
    try {
      return await mine;
    } finally {
      pending--;
    }
  }

  async function run(fen: string, request: AnalyseOptions): Promise<Analysis> {
    // MultiPV va reimpostato solo quando cambia: e' un'opzione globale del motore e
    // riscriverla ad ogni mossa costringe Stockfish a buttare la tabella di hash.
    if (request.multiPV !== currentMultiPV) {
      transport.send(`setoption name MultiPV value ${request.multiPV}`);
      currentMultiPV = request.multiPV;
    }
    transport.send(`position fen ${fen}`);

    // Teniamo l'ULTIMA riga vista per ciascun multipv: le profondita' intermedie
    // vengono sovrascritte da quelle piu' profonde, ed e' esattamente cio' che
    // vogliamo anche quando l'analisi viene interrotta a meta'.
    const best = new Map<number, EngineLine & { depth: number }>();
    let bestMove: string | null = null;
    let depth = 0;

    transport.send(`go depth ${request.depth}`);
    await collectUntil(
      (line) => line.startsWith('bestmove'),
      (line) => {
        if (line.startsWith('bestmove')) {
          const move = line.split(/\s+/)[1];
          bestMove = move && move !== '(none)' ? move : null;
          return;
        }
        const parsed = parseInfoLine(line);
        if (!parsed) return;
        const withDepth = parsed as EngineLine & { depth: number };
        const previous = best.get(withDepth.multipv);
        if (!previous || withDepth.depth >= previous.depth) best.set(withDepth.multipv, withDepth);
        if (withDepth.depth > depth) depth = withDepth.depth;
      },
    );

    const lines = [...best.values()].sort((a, b) => a.multipv - b.multipv);
    return { fen, depth, lines, bestMove };
  }

  return {
    analyse,
    stop: () => transport.send('stop'),
    quit: () => {
      transport.send('quit');
      transport.dispose();
    },
  };
}
