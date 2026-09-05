// Un'istanza di Stockfish in un processo figlio, che parla col padre via IPC.
//
// Due vincoli, entrambi scoperti provando:
//  1. il modulo node di stockfish.js e' un singleton — il secondo initEngine() nello
//     stesso processo fallisce ("INIT_ENGINE(...) is not a function") — e la
//     calibrazione ha bisogno di DUE motori accesi insieme (il bot e l'avversario di
//     riferimento);
//  2. un worker_thread non basta: il file del motore si disattiva da solo quando
//     `worker_threads.isMainThread` e' falso, e non esporta piu' nulla.
// Da qui il processo figlio, che per il motore e' un thread principale a tutti gli
// effetti e ha la propria cache dei moduli.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const initEngine = require('stockfish');

const build = process.argv[2] ?? 'lite-single';
const engine = await initEngine(build);

engine.listener = (line) => process.send?.(String(line));
process.on('message', (command) => engine.sendCommand(String(command)));
