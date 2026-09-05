import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UciTransport } from '../src/engine/types.js';

/**
 * Canale verso Stockfish in Node, per lo script di calibrazione.
 *
 * Esiste per una ragione sola: far girare in Node lo STESSO codice UCI e lo STESSO
 * bot che girano nel browser. Se la calibrazione misurasse un'implementazione diversa
 * da quella che gioca davvero, non misurerebbe niente di utile.
 *
 * Ogni motore vive in un processo figlio separato — vedi engineWorker.mjs per il
 * perche' (il modulo node di stockfish.js e' un singleton, e un worker_thread non
 * basta perche' il motore si disattiva quando non e' il thread principale).
 */
const here = dirname(fileURLToPath(import.meta.url));

export function createNodeTransport(build = 'lite-single'): UciTransport {
  const child = fork(join(here, 'engineWorker.mjs'), [build], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const listeners: ((line: string) => void)[] = [];

  child.on('message', (raw: unknown) => {
    if (typeof raw !== 'string') return;
    for (const line of raw.split('\n')) {
      if (line.trim()) for (const listener of listeners) listener(line.trim());
    }
  });
  child.on('error', (error) => {
    console.error('Errore nel motore:', error);
    process.exit(1);
  });

  return {
    send: (command) => child.send(command),
    onLine: (listener) => listeners.push(listener),
    dispose: () => void child.kill(),
  };
}
