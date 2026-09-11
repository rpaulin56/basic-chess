/**
 * Quanto la Nonna aspetta prima di muovere.
 *
 * Il motore ai livelli della Nonna risponde in pochi millesimi di secondo, e una
 * giocatrice ha segnalato che per un principiante e' "troppo immediata": il pezzo salta
 * mentre l'occhio segue ancora la propria mossa, non si vede cosa si e' mosso, e viene
 * da rispondere allo stesso ritmo.
 *
 * E' teatro consapevole: la forza della Nonna viene dalla profondita', non dai secondi.
 * Per questo e' un tempo MINIMO e non una pausa aggiunta: se la Nonna ha gia' impiegato
 * quel tempo (sul tablet, quando giudica la tua mossa, succede) non aspetta altro.
 *
 * Le mosse ovvie (una ripresa, una scelta quasi obbligata) arrivano prima delle altre:
 * senza dirlo, insegna che non tutte le mosse meritano lo stesso pensiero.
 */

export const PAUSE_MS = 1000;
export const OBVIOUS_PAUSE_MS = 500;

export function botPauseMs(options: { readonly obvious: boolean; readonly elapsedMs: number }): number {
  const target = options.obvious ? OBVIOUS_PAUSE_MS : PAUSE_MS;
  return Math.max(0, Math.round(target - options.elapsedMs));
}
