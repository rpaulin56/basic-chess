/**
 * Il diario del motore: gli ultimi eventi, tenuti nel browser di chi gioca.
 *
 * Nasce da un blocco visto su un telefono Samsung che qui non si puo' riprodurre: la
 * risposta della Nonna arrivata dopo trenta-sessanta secondi, e un'analisi di fine
 * partita ferma al primo tentativo e partita al secondo. Senza il telefono davanti si
 * puo' solo dedurre; con questo diario chi gioca copia gli eventi dalle impostazioni e
 * li manda, e si sa quale parte ha pesato — il caricamento, una ricerca lenta, un
 * riavvio.
 *
 * Resta tutto sul dispositivo: si legge solo quando chi gioca preme il pulsante, e
 * non parte verso nessuno da solo.
 */

export type EngineEvent =
  | { readonly kind: 'start' }
  | { readonly kind: 'ready'; readonly ms: number }
  | { readonly kind: 'search'; readonly depth: number; readonly reached: number; readonly multiPV: number; readonly ms: number }
  | { readonly kind: 'failure'; readonly message: string };

const KEY = 'basic-chess:engine-log';
/** Quanti eventi si tengono: abbastanza per una partita intera, non per una settimana. */
const MAX_EVENTS = 80;

export function noteEngine(event: EngineEvent): void {
  try {
    const events = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    events.push({ at: new Date().toISOString(), ...event });
    localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Memoria piena o negata: il diario e' un aiuto, non deve mai rompere il gioco.
  }
}

/** Il testo da copiare: il browser, e un evento per riga. */
export function engineReport(): string {
  let events: unknown[] = [];
  try {
    events = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
  } catch {
    events = [];
  }
  return [`GrandmaChess — ${navigator.userAgent}`, ...events.map((event) => JSON.stringify(event))].join('\n');
}
