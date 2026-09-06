// Genera public/openings.json dal dataset ECO di Lichess.
//
//   node tools/build-openings.mjs
//
// Fonte: https://github.com/lichess-org/chess-openings (CC0). Sono cinque file TSV
// (a..e) con colonne eco, name, pgn. Il risultato e' un solo oggetto JSON che mappa
// la POSIZIONE (non la sequenza di mosse) sul nome dell'apertura.
//
// Indicizzare per posizione e non per sequenza e' la differenza fra riconoscere e non
// riconoscere una trasposizione, che nella pratica e' la norma: 1.Cf3 d5 2.d4 e6 3.c4
// arriva alla stessa posizione del Gambetto di Donna Rifiutato per un'altra strada, e
// con l'indice per mosse restava senza nome (anzi, restava fermo al nome della prima
// mossa). La chiave e' il FEN senza i contatori e senza l'en passant: i contatori non
// distinguono le posizioni, e sull'en passant i generatori di FEN non concordano
// (alcuni lo indicano sempre dopo un doppio passo di pedone, altri solo se e'
// davvero catturabile).
//
// Il file generato viene COMMESSO nel repo: l'applicazione deve funzionare offline, e
// non puo' dipendere da GitHub al primo avvio. Questo script si rilancia solo quando
// si vuole aggiornare il dataset.

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

/** Chiave di posizione: disposizione dei pezzi, tratto, arrocchi. */
function positionKey(fen) {
  return fen.split(' ').slice(0, 3).join(' ');
}

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
    const chess = new Chess();
    try {
      for (const token of pgn.trim().split(/\s+/)) {
        if (/^\d+\.+$/.test(token)) continue;
        chess.move(token);
      }
    } catch {
      console.warn(`riga non rigiocabile, saltata: ${eco} ${name}`);
      continue;
    }
    // Se due sequenze arrivano alla stessa posizione vince la PRIMA: i file sono
    // ordinati per codice ECO, quindi resta il nome canonico invece di quello di una
    // variante esotica che ci arriva per trasposizione.
    const key = positionKey(chess.fen());
    if (!(key in openings)) openings[key] = `${eco}|${name}`;
    rows++;
  }
}

const out = join(root, 'public', 'openings.json');
await writeFile(out, JSON.stringify(openings));
console.log(`${rows} aperture scritte in public/openings.json`);
