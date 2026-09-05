import type { EngineLine } from './types.js';

/**
 * Conversione valutazione -> ASPETTATIVA di vittoria.
 *
 * Sul nome: "probabilita'" sarebbe scorretto. Questa sigmoide restituisce il
 * punteggio atteso su una partita (vittoria = 1, patta = 0.5), non la frequenza di
 * vittorie su molte ripetizioni — e di partite se ne gioca una sola.
 *
 * E' il pezzo concettualmente piu' importante di tutto il progetto, ed e' il motivo
 * per cui NON misureremo mai gli errori in centipawn: passare da +900 a +700 e'
 * irrilevante (si vince comunque), passare da 0 a -150 e' un dramma. La stessa
 * differenza di 200 centipawn vale quindi zero in un caso e tutto nell'altro.
 *
 * La sigmoide e' quella usata da Lichess, ricavata empiricamente dai risultati di
 * milioni di partite umane. Il coefficiente e' cio' che rende "probabilita' di
 * vittoria" un numero con un significato reale e non un'invenzione.
 */
const LICHESS_K = 0.00368208;

/** Probabilita' di vittoria (0..1) per chi ha il tratto, da una valutazione in centipawn. */
export function winProbFromCp(cp: number): number {
  return 1 / (1 + Math.exp(-LICHESS_K * cp));
}

/**
 * Probabilita' di vittoria (0..1) per chi ha il tratto, da una linea del motore.
 * Un matto forzato non e' "molto vantaggioso": e' vinto. Lo trattiamo come 1 o 0 —
 * altrimenti la differenza fra "matto in 3" e "matto in 5" produrrebbe scarti di
 * valutazione privi di senso didattico.
 */
export function winProbOf(line: EngineLine): number {
  if (line.mateIn !== null) return line.mateIn > 0 ? 1 : 0;
  return winProbFromCp(line.scoreCp ?? 0);
}

/** Come winProbOf, ma in punti percentuali: e' l'unita' in cui ragioneremo sempre. */
export function winPercentOf(line: EngineLine): number {
  return winProbOf(line) * 100;
}

/**
 * Valutazione leggibile: "+1.35", "-0.20", "M4", "-M2".
 * Il segno e' sempre dal punto di vista del BIANCO (convenzione universale), non di
 * chi ha il tratto: il motore ragiona sul tratto, l'utente ragiona sui colori.
 */
export function formatScore(line: EngineLine, sideToMove: 'w' | 'b'): string {
  const flip = sideToMove === 'b' ? -1 : 1;
  if (line.mateIn !== null) {
    const mate = line.mateIn * flip;
    return `${mate > 0 ? '' : '-'}M${Math.abs(mate)}`;
  }
  const pawns = ((line.scoreCp ?? 0) * flip) / 100;
  return `${pawns > 0 ? '+' : pawns < 0 ? '' : '±'}${pawns.toFixed(2)}`;
}
