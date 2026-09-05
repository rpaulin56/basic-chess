/**
 * Notazione a figure (figurine algebraic notation).
 *
 * La SAN prodotta da chess.js usa le iniziali inglesi (K Q R B N). In notazione a
 * figure si sostituisce l'iniziale con il glifo del pezzo: e' indipendente dalla
 * lingua, ed e' il motivo per cui la lista mosse NON va tradotta pezzo per pezzo.
 * Per convenzione tipografica si usano i glifi pieni per entrambi i colori.
 */

const GLYPH: Record<string, string> = {
  K: '\u265A',
  Q: '\u265B',
  R: '\u265C',
  B: '\u265D',
  N: '\u265E',
};

/**
 * Sostituisce l'iniziale del pezzo con il glifo, lasciando intatto tutto il resto
 * (case, catture, scacco, matto, promozione, en passant).
 * Attenzione alla `B` di alfiere contro la casa `b`: la SAN e' case-sensitive e le
 * case sono minuscole, quindi la sostituzione delle sole maiuscole e' sufficiente.
 */
export function toFigurine(san: string): string {
  // L'arrocco (O-O / O-O-O) non contiene iniziali di pezzo: passa indenne.
  return san.replace(/[KQRBN]/g, (letter) => GLYPH[letter] ?? letter);
}
