// Genera public/book.json: il libro di apertura della Nonna.
//
//   node tools/build-book.mjs
//
// Fonte: l'opening explorer di Lichess (explorer.lichess.org), fascia 1200-1800 in
// blitz, rapid e classica. Non e' il libro dei maestri ed e' deliberato: la Nonna deve
// giocare quello che si gioca al livello di chi la usa, non quello che si gioca in
// candidati. Il bullet resta fuori: li' si muove a caso per il tempo.
//
// A che serve, in tre punti:
//   1. La Nonna gioca aperture normali invece di 1.a3, scegliendo fra le mosse del libro
//      con probabilita' proporzionale a quanto sono giocate.
//   2. "Fuori teoria" diventa vero: non "questa posizione non ha un nome" (quello lo dice
//      openings.json) ma "qui si esce da quello che si gioca".
//   3. La modalita' "studia aperture" disegna una freccia per ogni mossa del libro, con
//      lo spessore dato da quanto e' giocata.
//
// L'esplorazione va per PROBABILITA': una coda ordinata per quota di partite che passano
// da una posizione, sempre la piu' battuta per prima, fino a esaurire il budget. Cosi' il
// libro copre quello che capita davvero — tutte le difese comuni alla prima mossa prima
// della decima mossa di una variante sola — invece di tre alla dodicesima.
//
// Lo script e' lento per educazione (una richiesta alla volta, con una pausa): l'explorer
// e' un servizio gratuito. Si rilancia solo quando si vuole aggiornare il libro, e il
// file generato viene COMMESSO nel repo, perche' l'applicazione deve funzionare offline.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

/** Fin dove si scende, in semi-mosse: dodici sono sei mosse per parte. */
const MAX_PLIES = 12;
/**
 * Quante mosse si tengono per posizione.
 *
 * Tre erano poche, e il primo libro lo ha mostrato: dopo 1.e4 il libro conosceva solo
 * e5, c5 e d5, quindi Francese, Caro-Kann, Pirc e Alekhine non c'erano proprio — e sono
 * risposte comunissime. Con la risposta del principiante fuori libro la Nonna tornava
 * subito alle mosse strane, che e' proprio cio' che il libro deve evitare.
 */
const TOP_MOVES = 6;
/** Sotto questa quota una mossa e' una curiosita': non si tiene e non ci si scende. */
const MIN_SHARE = 0.02;
/** Sotto questo numero di partite la percentuale non dice niente. */
const MIN_GAMES = 200;
/**
 * Il budget: quante posizioni al massimo.
 *
 * Non e' una rete di sicurezza ma il vero criterio. Si esplorano le posizioni PIU'
 * PROBABILI per prime (una coda ordinata per quota di partite che ci passano) e ci si
 * ferma quando il budget finisce: con lo stesso numero di richieste si copre cio' che
 * capita davvero, invece di scendere in fondo a una variante sola. Scendere per rami
 * dava 196 posizioni con l'Italiana fino alla decima semi-mossa e la Francese assente.
 */
const MAX_POSITIONS = 3000;
/**
 * La pausa fra una richiesta e l'altra.
 *
 * Misurata, non scelta: a 120ms e poi a 400ms l'explorer rispondeva 429 a OGNI richiesta,
 * e ogni successo arrivava dopo un'attesa di ripiego — 350 richieste in dieci minuti,
 * tutte frenate. Un secondo e mezzo e' il ritmo che il servizio accetta senza protestare.
 */
const PAUSE_MS = 1500;

/**
 * Il token di Lichess, letto dall'ambiente e mai scritto nel repo.
 *
 * L'explorer sta dietro autenticazione (la specifica dichiara `security: OAuth2`, e senza
 * token risponde con una pagina nginx 401). Basta un token personale SENZA permessi:
 * lichess.org/account/oauth/token -> "New access token", nessuna casella spuntata.
 *
 *   PowerShell:  $env:LICHESS_TOKEN = "lip_..."; node tools/build-book.mjs
 *   bash:        LICHESS_TOKEN=lip_... node tools/build-book.mjs
 *
 * Serve solo QUI, per generare il file. L'applicazione non parla con nessuno.
 */
const TOKEN = process.env.LICHESS_TOKEN ?? '';

const RATINGS = '1200,1400,1600';
const SPEEDS = 'blitz,rapid,classical';

/** Chiave di posizione: disposizione, tratto, arrocchi. La stessa di openings.json. */
function positionKey(fen) {
  return fen.split(' ').slice(0, 3).join(' ');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function explore(fen, attempt = 0) {
  const url =
    // explorer.lichess.ORG, non .ovh: il vecchio host risponde 401 da settembre 2026.
    'https://explorer.lichess.org/lichess?variant=standard' +
    `&speeds=${SPEEDS}&ratings=${RATINGS}&moves=${TOP_MOVES}&topGames=0&recentGames=0` +
    `&fen=${encodeURIComponent(fen)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (response.status === 429 || response.status >= 500) {
    // L'explorer chiede di rallentare: si aspetta quanto dice lui, se lo dice, e comunque
    // si parte da dieci secondi. Ripartire dopo due, come si faceva, vuol dire farsi
    // frenare di nuovo subito e tempestarlo di richieste rifiutate.
    if (attempt >= 6) throw new Error(`explorer: HTTP ${response.status}, troppi tentativi`);
    const told = Number(response.headers.get('retry-after')) * 1000;
    const wait = Math.min(120000, told > 0 ? told : 10000 * 2 ** attempt);
    console.log(`  … HTTP ${response.status}, aspetto ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return explore(fen, attempt + 1);
  }
  if (!response.ok) {
    // Il corpo distingue i casi: una pagina nginx e' un blocco di rete o un host morto,
    // un JSON di Lichess e' una richiesta sbagliata o un token che ci vorrebbe.
    const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 160);
    if (response.status === 401 && !TOKEN) {
      throw new Error(
        'explorer: 401 senza token. Crea un token personale senza permessi su ' +
          'lichess.org/account/oauth/token e rilancia con LICHESS_TOKEN impostato.',
      );
    }
    throw new Error(`explorer: HTTP ${response.status} — ${body}`);
  }
  return response.json();
}

const started = Date.now();
console.log(`Libro 1200-1800, ${MAX_PLIES} semi-mosse, prime ${TOP_MOVES} mosse per posizione.`);
console.log(TOKEN ? 'Token trovato.' : 'Nessun token: se l’explorer lo chiede, la richiesta fallira’.');
console.log(`Budget: ${MAX_POSITIONS} posizioni, prime ${TOP_MOVES} mosse sopra il ${MIN_SHARE * 100}%.`);

/**
 * Si riprende da dove si era arrivati: il file gia' sul disco vale come lavoro fatto.
 *
 * Serve perche' il giro e' lungo (un'ora buona) e una interruzione a meta' non deve
 * buttare via centinaia di richieste che il servizio ci ha gia' concesso. Le posizioni
 * gia' note non si richiedono: si leggono dal file e si usano per proseguire l'albero.
 */
const bookPath = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public', 'book.json');
let book = {};
try {
  book = JSON.parse(await readFile(bookPath, 'utf8'));
  console.log(`Riprendo da ${Object.keys(book).length} posizioni gia' sul disco.`);
} catch {
  // Nessun libro precedente: si parte da zero, ed e' il caso normale.
}
let requests = 0;
let sinceSave = 0;

/**
 * La coda delle posizioni da esplorare, tenuta ordinata per massa (la quota di partite
 * che ci arrivano). Poche migliaia di elementi: un array ordinato basta e avanza.
 */
const queue = [{ fen: new Chess().fen(), ply: 0, mass: 1 }];

function enqueue(item) {
  const at = queue.findIndex((other) => other.mass < item.mass);
  if (at === -1) queue.push(item);
  else queue.splice(at, 0, item);
}

while (queue.length > 0 && Object.keys(book).length < MAX_POSITIONS) {
  const { fen, ply, mass } = queue.shift();
  const key = positionKey(fen);
  // Posizione gia' nel libro: niente rete, si prosegue l'albero con quello che si sa.
  if (book[key]) {
    if (ply + 1 < MAX_PLIES) {
      for (const [san, share] of book[key]) {
        const next = new Chess(fen);
        try {
          next.move(san);
        } catch {
          continue;
        }
        enqueue({ fen: next.fen(), ply: ply + 1, mass: (mass * share) / 100 });
      }
    }
    continue;
  }
  const data = await explore(fen);
  requests++;
  if (requests % 25 === 0) {
    console.log(`  ${requests} richieste, ${Object.keys(book).length} posizioni, coda ${queue.length}`);
  }
  await sleep(PAUSE_MS);
  const total = data.white + data.draws + data.black;
  if (total < MIN_GAMES || !data.moves?.length) continue;
  const moves = data.moves
    .map((move) => ({ san: move.san, share: (move.white + move.draws + move.black) / total }))
    .filter((move) => move.share >= MIN_SHARE);
  if (moves.length === 0) continue;
  // Le quote sono sul totale delle partite in QUESTA posizione: e' cio' che serve sia per
  // sorteggiare la mossa della Nonna sia per lo spessore delle frecce.
  book[key] = moves.map((move) => [move.san, Math.max(1, Math.round(move.share * 100))]);
  // Ogni cinquanta posizioni si scrive: un'interruzione costa al massimo cinquanta
  // richieste, non tutto il giro.
  if (++sinceSave >= 50) {
    sinceSave = 0;
    await writeFile(bookPath, JSON.stringify(book));
  }
  if (ply + 1 >= MAX_PLIES) continue;
  for (const move of moves) {
    const next = new Chess(fen);
    next.move(move.san);
    enqueue({ fen: next.fen(), ply: ply + 1, mass: mass * move.share });
  }
}

const json = JSON.stringify(book);
await writeFile(bookPath, json);
const positions = Object.keys(book).length;
console.log(
  `Fatto: ${positions} posizioni, ${Math.round(json.length / 1024)} KB, ` +
    `${requests} richieste in ${Math.round((Date.now() - started) / 1000)}s.`,
);
if (queue.length > 0) console.log(`Budget esaurito: restavano ${queue.length} posizioni in coda.`);
