import type { UciTransport } from './types.js';

/**
 * Canale verso Stockfish nel browser: un Web Worker, cosi' l'analisi non blocca
 * l'interfaccia mentre il motore pensa.
 *
 * Il file del motore sta in public/engine/ (copiato da node_modules dallo script
 * scripts/copy-engine.mjs): dev'essere servito dalla nostra stessa origine, perche' un
 * Worker cross-origin e' vietato.
 */

/**
 * Build single-thread, sempre.
 *
 * La multi-thread sarebbe piu' veloce sulla carta, ma nel browser non parte: i worker
 * annidati che genera falliscono (provato). E soprattutto non serve — misurato qui:
 * profondita' 12 in ~70 ms, contro i 200-500 ms che il tutor puo' permettersi.
 *
 * Conseguenza non ovvia ma importante per il deploy: senza multi-thread non serve
 * SharedArrayBuffer, e quindi NON servono gli header COOP/COEP sul server. Il sito
 * resta ospitabile su qualunque hosting statico, senza configurazione.
 */
export function engineUrl(): string {
  return '/engine/stockfish-18-lite-single.js';
}

export function createBrowserTransport(): UciTransport {
  const worker = new Worker(engineUrl());
  const listeners: ((line: string) => void)[] = [];

  worker.addEventListener('message', (event: MessageEvent) => {
    // stockfish.js manda stringhe; alcune build incapsulano in {data}.
    const raw: unknown = typeof event.data === 'string' ? event.data : (event.data as { data?: unknown })?.data;
    if (typeof raw !== 'string') return;
    for (const line of raw.split('\n')) {
      if (line.trim()) for (const listener of listeners) listener(line.trim());
    }
  });

  return {
    send: (command) => worker.postMessage(command),
    onLine: (listener) => listeners.push(listener),
    dispose: () => worker.terminate(),
  };
}
