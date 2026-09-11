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

/** Quanto si aspetta l'avvio del motore prima di dichiararlo morto. */
// Novanta secondi e non trenta: il primo caricamento su un telefono lento deve
// scaricare e compilare 7 MB, e qui non c'e' modo di chiedere "ci sei?" finche' il
// motore non e' partito.
const HANDSHAKE_TIMEOUT_MS = 90_000;
/**
 * Il motore e' VIVO finche' risponde: nessuna scadenza fissa per le ricerche.
 *
 * C'erano trenta secondi per ogni ricerca, poi il motore veniva buttato via e
 * ricaricato. Su un computer una ricerca del tutor dura un secondo e la scadenza non
 * scattava mai; su un telefono lento poteva scattare su un motore SANO, e il riavvio
 * costava altri secondi di caricamento — e' la spiegazione piu' probabile di una
 * risposta arrivata dopo trenta-sessanta secondi.
 *
 * Adesso durante la ricerca, dopo qualche secondo senza notizie, gli si chiede "ci
 * sei?" (`isready`), a cui il protocollo impone di rispondere subito anche mentre
 * cerca: misurato, 8 ms nel browser a ricerca in corso. Si rinuncia solo se per
 * DEAD_AFTER_MS non arriva nessuna riga, di nessun tipo.
 */
const PING_AFTER_MS = 3_000;
const PING_EVERY_MS = 1_000;
const DEAD_AFTER_MS = 15_000;

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

  /**
   * Aspetta una riga che soddisfi il predicato, raccogliendo tutto nel frattempo.
   *
   * Con scadenza, e non per eccesso di zelo: se il worker muore (o smette di
   * rispondere per qualunque ragione) senza scadenza questa Promise resta appesa per
   * sempre, e con lei tutto cio' che la aspetta — la valutazione resta su "analisi…"
   * e il bot non muove mai piu'. E' un guasto osservato in partita, non un'ipotesi.
   */
  function collectUntil(
    done: (line: string) => boolean,
    onEach?: (line: string) => void,
    timeoutMs = 0,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = timeoutMs
        ? setTimeout(() => {
            onLineHandler = null;
            reject(new Error('il motore non risponde'));
          }, timeoutMs)
        : null;
      onLineHandler = (line) => {
        onEach?.(line);
        if (done(line)) {
          if (timer) clearTimeout(timer);
          onLineHandler = null;
          resolve();
        }
      };
    });
  }

  /**
   * Come `collectUntil`, ma senza scadenza fissa: si rinuncia solo se il motore smette di
   * rispondere (vedi DEAD_AFTER_MS). Ogni riga ricevuta, `readyok` compreso, conta come
   * segno di vita.
   */
  function collectWhileAlive(done: (line: string) => boolean, onEach: (line: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let lastLine = Date.now();
      const watch = setInterval(() => {
        const silent = Date.now() - lastLine;
        if (silent >= DEAD_AFTER_MS) {
          clearInterval(watch);
          onLineHandler = null;
          reject(new Error('il motore non risponde'));
        } else if (silent >= PING_AFTER_MS) {
          transport.send('isready');
        }
      }, PING_EVERY_MS);
      onLineHandler = (line) => {
        lastLine = Date.now();
        onEach(line);
        if (done(line)) {
          clearInterval(watch);
          onLineHandler = null;
          resolve();
        }
      };
    });
  }

  transport.send('uci');
  await collectUntil((line) => line.startsWith('uciok'), undefined, HANDSHAKE_TIMEOUT_MS);

  if (options.threads && options.threads > 1) {
    transport.send(`setoption name Threads value ${options.threads}`);
  }
  if (options.hashMb) transport.send(`setoption name Hash value ${options.hashMb}`);
  for (const [name, value] of Object.entries(options.uci ?? {})) {
    transport.send(`setoption name ${name} value ${value}`);
  }
  transport.send('isready');
  await collectUntil((line) => line.startsWith('readyok'), undefined, HANDSHAKE_TIMEOUT_MS);

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
    await collectWhileAlive(
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
