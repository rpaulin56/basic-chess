/**
 * Il tipo di una frase spiegata, con la sua chiave e i suoi parametri.
 *
 * Qui viveva anche `explainPositional`: le ragioni per cui una posizione peggiora (pedone
 * isolato, avamposto, coppia degli Alfieri...), confrontando la posizione prima
 * dell'errore con una presa piu' avanti lungo la variante del motore. Rimosso nel
 * settembre 2026: sulle prime quattro partite vere sarebbe comparso una volta sola, e
 * quell'unica volta la ragione spariva rifacendo il conto a profondita' piena. Come per il
 * materiale, era la coda della variante a decidere. Quando non c'e' un fatto certo il
 * tutor dice che la posizione peggiora e lo mostra con le conseguenze.
 */
export interface Explanation {
  /** Chiave i18n della frase. */
  readonly key: string;
  readonly params: Record<string, string | number>;
  /** Quanto pesa: serve solo a ordinare, non viene mostrato. */
  readonly weight: number;
}
