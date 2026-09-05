import { createBrowserTransport } from '../engine/browserTransport.js';
import { createEngine } from '../engine/uci.js';
import type { Analysis, AnalyseOptions, Engine } from '../engine/types.js';

/**
 * Il motore, avviato una volta sola e alla prima richiesta.
 *
 * Pigro di proposito: il .wasm pesa ~7 MB, e chi apre l'applicazione solo per
 * rivedere un PGN non ha motivo di scaricarlo. La prima analisi lo fa partire.
 *
 * Un motore solo per tutta l'applicazione: le richieste vengono gia' serializzate
 * dalla coda in engine/uci.ts, e due istanze raddoppierebbero memoria e caricamento
 * per analizzare comunque una posizione alla volta.
 */
export interface EngineSession {
  analyse(fen: string, options: AnalyseOptions): Promise<Analysis | null>;
  /** Messaggio d'errore se il motore non e' partito, altrimenti null. */
  error(): string | null;
  /** Vero mentre il motore si sta caricando. */
  loading(): boolean;
}

export function createEngineSession(onStateChange: () => void): EngineSession {
  let engine: Promise<Engine> | null = null;
  let failure: string | null = null;
  let isLoading = false;

  function start(): Promise<Engine> {
    isLoading = true;
    onStateChange();
    const promise = createEngine(createBrowserTransport(), { hashMb: 32 });
    promise.then(
      () => {
        isLoading = false;
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

  return {
    async analyse(fen, options) {
      if (failure) return null;
      engine ??= start();
      try {
        return await (await engine).analyse(fen, options);
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
        onStateChange();
        return null;
      }
    },
    error: () => failure,
    loading: () => isLoading,
  };
}
