import type { Color } from 'chess.js';
import { features } from './features.js';
import type { Explanation } from './positional.js';

/**
 * "Che cosa guardo, in questa posizione?"
 *
 * Serve al caso in cui le mosse giocabili sono molte: li' l'elenco non risponde alla
 * domanda vera, che non e' "quale mossa" ma "che piano". Queste regole non giudicano
 * una mossa — non ce n'e' ancora una — ma descrivono la posizione COM'E', indicando la
 * caratteristica su cui vale la pena costruire qualcosa.
 *
 * Sono le stesse misure che spiegano l'errore strategico (features.ts), usate su UNA
 * posizione invece che su due: li' si guarda cosa e' peggiorato, qui cosa c'e'. E si
 * confrontano i due colori, perche' quasi tutto cio' che conta in una posizione e'
 * comparativo: avere un pedone passato conta se l'avversario non ce l'ha.
 *
 * Il criterio di ammissione e' lo stesso del resto del tutor: una regola entra solo se,
 * quando scatta, produce una frase che dice a un principiante cosa fare dopo. Per
 * questo si dichiara al massimo due cose e si tace volentieri: un elenco di sei
 * osservazioni e' un referto, e da un referto non si ricava un piano.
 */

/** Quante osservazioni al massimo. Due sono un consiglio, sei sono un referto. */
const MAX_REASONS = 2;

export function orientPosition(fen: string, color: Color): readonly Explanation[] {
  const mine = features(fen, color);
  const theirs = features(fen, color === 'w' ? 'b' : 'w');
  const found: Explanation[] = [];

  // La sicurezza del re viene prima di qualunque piano: se e' scoperto, il piano e'
  // metterlo al sicuro.
  if (mine.kingShield <= 1) {
    found.push({ key: 'orientKingExposed', params: {}, weight: 10 });
  }
  // Un cavallo installato a casa propria non se ne va da solo, e finche' e' li'
  // qualunque altro piano parte in svantaggio di un pezzo.
  if (mine.enemyOutposts > 0) {
    found.push({ key: 'orientOutpost', params: {}, weight: 8 });
  }
  // Un passato e' una minaccia che cresce da sola: e' quasi sempre il piano.
  if (mine.passedPawns > theirs.passedPawns) {
    found.push({ key: 'orientPassed', params: {}, weight: 7 });
  }
  // Colonna aperta occupata da lui e non da te: e' il posto dove sta per succedere
  // qualcosa, e ci si arriva prima portandoci una torre.
  if (theirs.rooksOnOpenFiles > mine.rooksOnOpenFiles) {
    found.push({ key: 'orientOpenFile', params: {}, weight: 6 });
  }
  // La coppia degli alfieri vale se la posizione si apre: e' un piano, non un trofeo.
  if (mine.bishopPair && !theirs.bishopPair) {
    found.push({ key: 'orientBishopPair', params: {}, weight: 5 });
  }
  // Molte mosse in meno dell'avversario vuol dire pezzi che non partecipano: il piano
  // e' farli partecipare, e questa e' la cosa che un principiante non guarda mai.
  if (theirs.mobility - mine.mobility >= 6) {
    found.push({ key: 'orientCramped', params: {}, weight: 5 });
  }
  // La struttura si dice per ultima: e' vera, ma da sola non suggerisce cosa fare
  // adesso, e occuperebbe il posto di qualcosa di piu' utile.
  if (mine.isolatedPawns > theirs.isolatedPawns) {
    found.push({ key: 'orientIsolated', params: {}, weight: 3 });
  }

  // Se non spicca niente, la risposta non e' il silenzio: e' la domanda che un
  // giocatore esperto si fa proprio in queste posizioni, e che un principiante non si
  // fa mai. "Migliora il pezzo peggiore" e' il principio piu' utile che esista quando
  // non c'e' nient'altro da dire, e qui e' esattamente il caso.
  if (found.length === 0) return [{ key: 'orientNothing', params: {}, weight: 1 }];

  return found.sort((a, b) => b.weight - a.weight).slice(0, MAX_REASONS);
}
