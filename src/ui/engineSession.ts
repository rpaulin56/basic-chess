import { createBrowserTransport } from '../engine/browserTransport.js';
import { createEngine } from '../engine/uci.js';
import type { Analysis, AnalyseOptions, Engine, UciTransport } from '../engine/types.js';

/**
 * Il motore, avviato una volta sola e alla prima richiesta.
 *
 * Pigro di proposito: il .wasm pesa ~7 MB, e chi apre l'applicazione solo per
 * rivedere un PGN non ha motivo di scaricarlo. La prima analisi lo fa partire.
 *
 * Un motore solo per tutta l'applicazione: le richieste vengono gia' serializzate
 * dalla coda in engine/uci.ts, e due istanze raddoppierebbero memoria e caricamento
 * per analizzare comunque una posizione alla volta.
 *
 * RIAVVIABILE. Un worker che muore (o smette di rispondere) e' un guasto osservato in
 * partita: senza riavvio l'applicazione resta bloccata per sempre — valutazione ferma
 * su "analisi…" e bot che non muove piu'. Qui un errore butta via l'istanza rotta e
 * la richiesta successiva ne crea una nuova.
 */
export interface EngineSession {
  analyse(fen: string, options: AnalyseOptions): Promise<Analysis | null>;
  /** Messaggio dell'ultimo guasto, azzerato appena il motore torna a rispondere. */
  error(): string | null;
  /** Vero mentre il motore si sta caricando. */
  loading(): boolean;
}

/** Oltre questo numero di guasti consecutivi si smette di riprovare. */
const MAX_RESTARTS = 3;

export function createEngineSession(onStateChange: () => void): EngineSession {
  let engine: Promise<Engine> | null = null;
  let transport: UciTransport | null = null;
  let failure: string | null = null;
  let isLoading = false;
  let restarts = 0;

  function start(): Promise<Engine> {
    isLoading = true;
    onStateChange();
    transport = createBrowserTransport();
    const promise = createEngine(transport, { hashMb: 32 });
    promise.then(
      () => {
        isLoading = false;
        failure = null;
        onStateChange();
      },
      (error: unknown) => {
        isLoading = false;
        failure = error instanceof Error ? error.message : String(error);
        onStateChange();
      },
    );
    return promise;
  }

  /** Butta via l'istanza rotta: la prossima richiesta ne creera' una nuova. */
  function discard(error: unknown): void {
    failure = error instanceof Error ? error.message : String(error);
    try {
      transport?.dispose();
    } catch {
      // Il worker era gia' morto: e' esattamente il caso che stiamo gestendo.
    }
    transport = null;
    engine = null;
    isLoading = false;
    restarts++;
    onStateChange();
  }

  return {
    async analyse(fen, options) {
      if (restarts > MAX_RESTARTS) return null;
      engine ??= start();
      try {
        const result = await (await engine).analyse(fen, options);
        // Una risposta buona chiude l'incidente: il contatore riparte da zero, cosi'
        // un guasto isolato non consuma il credito di riavvii per tutta la sessione.
        if (failure) {
          failure = null;
          onStateChange();
        }
        restarts = 0;
        return result;
      } catch (error) {
        discard(error);
        return null;
      }
    },
    error: () => failure,
    loading: () => isLoading,
  };
}
