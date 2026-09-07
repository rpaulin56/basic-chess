/**
 * Il giudizio sulle due domande che chiudono una partita: "conviene abbandonare?" e
 * "ha senso offrire la patta?".
 *
 * E' la meta' didattica di una funzione che altrove e' solo un comando. Abbandonare e
 * offrire patta sono decisioni, e imparare a prenderle — capire QUANDO l'esito e'
 * ormai deciso — vale quanto imparare una tecnica di finale. Un programma che si
 * limitasse a chiudere la partita farebbe il contrario: toglierebbe la decisione.
 *
 * Le soglie sono in punti di aspettativa di vittoria, non in centipawn, perche' la
 * domanda e' pratica e non tecnica: non "quanto sto peggio" ma "quante probabilita'
 * ho di portarla a casa".
 */

/**
 * Sotto questa aspettativa la partita e' persa e basta.
 *
 * E' la stessa soglia con cui il tutor smette di segnalare gli errori ("posizione
 * ormai persa"): usarne una nuova qui vorrebbe dire farsi contraddire da se', con il
 * tutor che tace perche' e' finita e insieme dice che c'e' ancora da giocare.
 */
export const HOPELESS = 12;

/** Sotto questa si sta peggio, ma la partita e' viva. */
export const WORSE = 40;

/** Sopra questa si sta meglio, e arrendersi o proporre patta non ha senso. */
export const WINNING = 60;

/**
 * Prima di questa mossa la patta non si offre.
 *
 * Non e' una regola degli scacchi — un'offerta alla quinta mossa e' formalmente
 * legittima — ma e' una regola didattica: offrire patta in apertura in posizione pari
 * insegna a scappare, ed e' esattamente l'abitudine che questo programma non deve
 * costruire.
 */
export const EARLY_MOVES = 20;

export type ResignVerdict = 'winning' | 'balanced' | 'worse' | 'hopeless';
export type DrawVerdict = 'tooEarly' | 'winning' | 'balanced' | 'worse' | 'hopeless';

/** Conviene abbandonare? `hopeless` e' l'unico caso in cui la risposta e' si'. */
export function judgeResign(winPercent: number): ResignVerdict {
  if (winPercent >= WINNING) return 'winning';
  if (winPercent >= WORSE) return 'balanced';
  if (winPercent >= HOPELESS) return 'worse';
  return 'hopeless';
}

/**
 * Ha senso offrire la patta? `balanced` e `worse` sono offerte ragionevoli; nel primo
 * caso l'avversaria dovrebbe accettare, nel secondo ha tutto il diritto di rifiutare.
 */
export function judgeDraw(winPercent: number, moveNumber: number): DrawVerdict {
  if (moveNumber < EARLY_MOVES) return 'tooEarly';
  if (winPercent >= WINNING) return 'winning';
  if (winPercent >= WORSE) return 'balanced';
  if (winPercent >= HOPELESS) return 'worse';
  return 'hopeless';
}

/**
 * L'avversaria accetta la patta?
 *
 * Risponde con la SUA valutazione al SUO livello, non con la verita' a profondita'
 * alta: un'avversaria da 900 punti che rifiuta una patta obiettivamente giusta e'
 * realistica, e insegna la cosa che conta — che le offerte si valutano da soli, perche'
 * chi te le fa o te le rifiuta puo' benissimo sbagliarsi.
 */
export function acceptsDraw(opponentWinPercent: number): boolean {
  return opponentWinPercent < WINNING;
}
