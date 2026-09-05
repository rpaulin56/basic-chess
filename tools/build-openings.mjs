// Genera public/openings.json dal dataset ECO di Lichess.
//
//   node tools/build-openings.mjs
//
// Fonte: https://github.com/lichess-org/chess-openings (CC0). Sono cinque file TSV
// (a..e) con colonne eco, name, pgn. Il risultato e' un solo oggetto JSON che mappa
// la sequenza di mosse SAN, separate da spazi e senza numerazione, sul nome.
//
// Il file generato viene COMMESSO nel repo: l'applicazione deve funzionare offline, e
// non puo' dipendere da GitHub al primo avvio. Questo script si rilancia solo quando
// si vuole aggiornare il dataset.

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const openings = {};
let rows = 0;

for (const letter of ['a', 'b', 'c', 'd', 'e']) {
  const response = await fetch(`${BASE}/${letter}.tsv`);
  if (!response.ok) throw new Error(`${letter}.tsv: HTTP ${response.status}`);
  const text = await response.text();
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t');
    if (!eco || !name || !pgn) continue;
    // "1. e4 e5 2. Nf3" -> "e4 e5 Nf3": la numerazione non serve a riconoscere nulla
    // e raddoppierebbe il peso del file.
    const moves = pgn
      .trim()
      .split(/\s+/)
      .filter((token) => !/^\d+\.+$/.test(token))
      .join(' ');
    openings[moves] = `${eco}|${name}`;
    rows++;
  }
}

const out = join(root, 'public', 'openings.json');
await writeFile(out, JSON.stringify(openings));
console.log(`${rows} aperture scritte in public/openings.json`);
