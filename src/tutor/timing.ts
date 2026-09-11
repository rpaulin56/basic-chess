/**
 * Quanto pensa di solito chi gioca, e la mossa giocata di fretta che e' costata cara.
 *
 * Il tempo da solo non insegna niente — "quattordici secondi a mossa" non e' ne' bene ne'
 * male, e la Nonna non ha l'orologio. Diventa utile incrociato con quanto contava la
 * mossa: "questa l'hai giocata in tre secondi, meno della meta' del tuo solito, ed e'
 * costata trenta punti". Per quella frase serve un "solito", ed e' la mediana.
 *
 * La MEDIANA e non la media: una pausa di venti minuti con la pagina aperta non la
 * sposta, e cosi' non serve decidere una soglia oltre la quale un tempo "non vale".
 * Le pause che si possono vedere (scheda nascosta, pagina ricaricata) sono gia' segnate
 * come `interrupted` e non entrano. Il chiamante esclude anche le mosse che non dicono
 * come si pensa: quelle d'apertura giocate a memoria e quelle ovvie.
 */

export interface TimedMove {
  readonly ply: number;
  readonly ms: number;
  readonly interrupted: boolean;
}

/** Sotto questo numero di mosse contate un "solito" non c'e' ancora. */
export const MIN_COUNTED = 8;

/**
 * Sotto questa mediana "meno della meta'" vuol dire una manciata di secondi, e chi gioca
 * cosi' veloce lo fa per tutta la partita: segnalare una mossa sola sarebbe arbitrario.
 */
export const HASTY_MIN_MEDIAN_MS = 6000;

/** La mediana dei tempi che contano, o null se sono troppo pochi. */
export function usualThinking(
  times: readonly TimedMove[],
  counts: (ply: number) => boolean,
): number | null {
  const values = times
    .filter((time) => !time.interrupted && counts(time.ply))
    .map((time) => time.ms)
    .sort((a, b) => a - b);
  if (values.length < MIN_COUNTED) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}

/**
 * Fra le mosse candidate (gia' scelte dal chiamante: le sue, costose, a partita aperta),
 * la piu' costosa giocata in meno della meta' del solito. Una sola: e' una frase, non un
 * elenco di rimproveri.
 */
export function hastiest<T extends { readonly ply: number; readonly drop: number }>(
  times: readonly TimedMove[],
  candidates: readonly T[],
  median: number,
): { readonly move: T; readonly ms: number } | null {
  if (median < HASTY_MIN_MEDIAN_MS) return null;
  let found: { move: T; ms: number } | null = null;
  for (const move of candidates) {
    const time = times.find((entry) => entry.ply === move.ply && !entry.interrupted);
    if (!time || time.ms * 2 >= median) continue;
    if (!found || move.drop > found.move.drop) found = { move, ms: time.ms };
  }
  return found;
}
