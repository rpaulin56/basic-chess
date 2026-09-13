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

/**
 * Quanto aspetta mentre stai studiando le aperture.
 *
 * Molto di piu', e per una ragione precisa: con le frecce accese, prima che lei muova le
 * frecce sulla scacchiera sono le SUE possibili risposte, ed e' proprio quello che vuoi
 * guardare. Con un secondo scandiscono appena, e per rivederle tocca tornare indietro
 * (segnalato usandolo). Qui la fretta non serve a nessuno: si sta studiando.
 *
 * Cinque secondi e non tre e mezzo: provata in partita, l'attesa piu' lunga non pesa —
 * serve a leggere le frecce e, volendo, a sceglierle la risposta cliccandone una.
 */
export const STUDY_PAUSE_MS = 5000;

export function botPauseMs(options: {
  readonly obvious: boolean;
  readonly elapsedMs: number;
  readonly studying?: boolean;
}): number {
  const target = options.studying
    ? STUDY_PAUSE_MS
    : options.obvious
      ? OBVIOUS_PAUSE_MS
      : PAUSE_MS;
  return Math.max(0, Math.round(target - options.elapsedMs));
}
