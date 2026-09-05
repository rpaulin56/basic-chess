// Copia le build di Stockfish da node_modules a public/engine/.
//
// Perche' non importarle direttamente da node_modules: il file .js del motore va
// caricato come Web Worker dalla NOSTRA origine (un Worker cross-origin e' vietato, e
// con COEP require-corp lo sarebbe comunque), e cerca il proprio .wasm accanto a se'.
// public/ e' l'unica cartella che Vite copia in dist/ senza toccare i contenuti.
//
// public/engine/ NON sta in git (~14 MB di binari): lo ricrea questo script, che gira
// da solo dopo npm install e prima di dev/build.

import { cp, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(root, 'node_modules', 'stockfish', 'bin');
const to = join(root, 'public', 'engine');

// Solo la build "lite" SINGLE-THREAD, per due ragioni misurate:
//  - "lite" invece della completa: ~7 MB invece di 113 MB da scaricare al primo avvio.
//    Per un tutor che analizza a profondita' 12-16 la differenza di forza e'
//    irrilevante; la differenza di attesa no.
//  - "single" invece della multi-thread: la build multi-thread non parte nel browser
//    (i worker annidati che genera falliscono), mentre la single-thread fa profondita'
//    12 in ~70 ms — dieci volte piu' veloce di quanto ci serva. Portarsi dietro anche
//    l'altra significherebbe raddoppiare il peso per una cosa che non funziona.
const WANTED = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];

if (!existsSync(from)) {
  console.error('Stockfish non trovato in node_modules: lanciare prima "npm install".');
  process.exit(1);
}

await mkdir(to, { recursive: true });
const available = await readdir(from);
for (const file of WANTED) {
  if (!available.includes(file)) {
    console.error(`File del motore mancante: ${file}`);
    process.exit(1);
  }
  await cp(join(from, file), join(to, file));
}
console.log(`Motore copiato in public/engine/ (${WANTED.length} file).`);
