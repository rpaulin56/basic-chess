/**
 * Nome dell'apertura in corso, dal dataset ECO di Lichess.
 *
 * Il file (~430 KB) si carica UNA volta sola e solo quando serve davvero, cioe' alla
 * prima posizione da riconoscere: chi apre l'applicazione per rivedere un finale non
 * ha motivo di scaricarlo. E' comunque servito dalla nostra origine, quindi il
 * riconoscimento funziona offline come il resto.
 *
 * L'indice e' per POSIZIONE, non per sequenza di mosse: e' cio' che permette di
 * riconoscere le trasposizioni, che nella pratica sono la norma. Vedi
 * tools/build-openings.mjs per come viene generato.
 */

export interface Opening {
  readonly eco: string;
  readonly name: string;
  /** Quante semi-mosse della partita sono state riconosciute. */
  readonly plies: number;
}

let table: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

async function load(): Promise<Record<string, string>> {
  const response = await fetch('/openings.json');
  if (!response.ok) throw new Error(`openings.json: HTTP ${response.status}`);
  return (await response.json()) as Record<string, string>;
}

/** Chiave di posizione: disposizione dei pezzi, tratto, arrocchi. Come nel generatore. */
function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 3).join(' ');
}

/**
 * Riconosce l'apertura da una sequenza di posizioni (FEN), dalla partenza alla
 * posizione mostrata.
 *
 * Si cerca a ritroso e ci si ferma alla PIU' RECENTE riconosciuta: finche' la partita
 * segue sentieri noti il nome si affina mossa dopo mossa, e quando esce dai libri
 * resta l'ultimo nome valido invece di sparire. E' anche il comportamento che si vede
 * su Lichess, quindi non sorprende nessuno.
 */
export async function findOpening(fens: readonly string[]): Promise<Opening | null> {
  table ??= await (loading ??= load());
  for (let index = fens.length - 1; index >= 0; index--) {
    const entry = table[positionKey(fens[index]!)];
    if (entry) {
      const separator = entry.indexOf('|');
      return { eco: entry.slice(0, separator), name: entry.slice(separator + 1), plies: index };
    }
  }
  return null;
}
