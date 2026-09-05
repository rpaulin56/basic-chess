/**
 * Nome dell'apertura in corso, dal dataset ECO di Lichess.
 *
 * Il file (~340 KB) si carica UNA volta sola e solo quando serve davvero, cioe' alla
 * prima posizione da riconoscere: chi apre l'applicazione per rivedere un finale non
 * ha motivo di scaricarlo. E' comunque servito dalla nostra origine, quindi il
 * riconoscimento funziona offline come il resto.
 *
 * Generato da tools/build-openings.mjs — vedi quel file per la fonte e la licenza.
 */

export interface Opening {
  readonly eco: string;
  readonly name: string;
  /** Quante semi-mosse della partita sono state riconosciute. */
  readonly plies: number;
}

/** Oltre questa lunghezza nessuna apertura e' classificata: inutile cercare. */
const LONGEST = 40;

let table: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

async function load(): Promise<Record<string, string>> {
  const response = await fetch('/openings.json');
  if (!response.ok) throw new Error(`openings.json: HTTP ${response.status}`);
  return (await response.json()) as Record<string, string>;
}

/**
 * Riconosce l'apertura dalla lista di mosse in SAN.
 *
 * Cerca la corrispondenza PIU' LUNGA: la sequenza completa identifica una variante
 * precisa, i suoi prefissi identificano l'apertura generica, e a un principiante
 * serve il nome piu' specifico che sia ancora vero. Restituisce null se la partita e'
 * uscita dai sentieri classificati — che, va detto, succede prestissimo.
 */
export async function findOpening(san: readonly string[]): Promise<Opening | null> {
  table ??= await (loading ??= load());
  const limit = Math.min(san.length, LONGEST);
  for (let length = limit; length > 0; length--) {
    const entry = table[san.slice(0, length).join(' ')];
    if (entry) {
      const separator = entry.indexOf('|');
      return { eco: entry.slice(0, separator), name: entry.slice(separator + 1), plies: length };
    }
  }
  return null;
}
