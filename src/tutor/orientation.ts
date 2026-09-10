import { Chess, type Color } from 'chess.js';
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

/**
 * Quanto materiale d'attacco serve perche' la sicurezza del re sia un tema.
 *
 * Sei punti: una Donna (9) basta da sola, Torre piu' pezzo leggero (8) pure, due
 * pezzi leggeri (6) al limite. Un Cavallo solo (3) no — e quello e' il caso che ha
 * prodotto il consiglio sbagliato, "metti il Re al sicuro" detto a chi aveva davanti
 * un Re, un Cavallo e qualche pedone.
 *
 * Sotto questa soglia il consiglio non e' soltanto inutile: e' ROVESCIATO. In finale
 * il Re e' un pezzo che deve combattere, e tenerlo al riparo dietro i suoi pedoni e'
 * uno degli errori piu' comuni di chi comincia.
 */
const ATTACK_ENOUGH = 6;
const PIECE_VALUE: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 };

/** Materiale d'attacco di `color`, pedoni e Re esclusi. */
function attackingMaterial(fen: string, color: Color): number {
  const chess = new Chess(fen);
  let total = 0;
  for (const row of chess.board()) {
    for (const square of row) {
      if (square && square.color === color) total += PIECE_VALUE[square.type] ?? 0;
    }
  }
  return total;
}

function hasQueen(fen: string, color: Color): boolean {
  return new Chess(fen)
    .board()
    .some((row) => row.some((square) => square !== null && square.color === color && square.type === 'q'));
}

/** Quanto dista il Re dal centro: 0 sulle quattro case centrali, 3 negli angoli. */
function kingFromCentre(fen: string, color: Color): number {
  const chess = new Chess(fen);
  for (const row of chess.board()) {
    for (const square of row) {
      if (square && square.color === color && square.type === 'k') {
        const file = 'abcdefgh'.indexOf(square.square[0]!);
        const rank = Number(square.square[1]) - 1;
        const fromEdge = Math.min(Math.min(file, 7 - file), Math.min(rank, 7 - rank));
        return 3 - fromEdge;
      }
    }
  }
  return 0;
}

export function orientPosition(fen: string, color: Color): readonly Explanation[] {
  const mine = features(fen, color);
  const theirs = features(fen, color === 'w' ? 'b' : 'w');
  const found: Explanation[] = [];

  // La sicurezza del re viene prima di qualunque piano: se e' scoperto, il piano e'
  // metterlo al sicuro. Ma SOLO se dall'altra parte c'e' con cosa attaccarlo: senza
  // questa condizione il consiglio scattava anche in finale, dove e' rovesciato.
  //
  // E serve la DONNA nemica, e una STRADA verso il Re: una colonna aperta con sopra
  // una Torre o la Donna avversaria, oppure almeno due case attorno al Re controllate.
  // Con la sola soglia di materiale il consiglio scattava anche senza Donne, in
  // posizioni chiuse dove nessuno poteva arrivare al Re: misurato su una partita vera,
  // 34 volte su 34 mosse, fino alla mossa in cui era chi giocava a dare matto. Con le
  // due condizioni, 3. Il posto lasciato libero lo prende quello che c'e' davvero da
  // fare — spesso il pedone passato, o "fai partecipare il pezzo che non gioca".
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const attack = attackingMaterial(fen, enemy);
  const approach = mine.kingOpenFiles >= 1 || mine.kingAttackers >= 2;
  if (mine.kingShield <= 1 && hasQueen(fen, enemy) && approach) {
    found.push({ key: 'orientKingExposed', params: {}, weight: 10 });
  }
  // Il contrario, e vale nello stesso momento in cui l'altro tace: finito il
  // materiale d'attacco il Re diventa un pezzo, e lasciarlo nell'angolo e' rinunciare
  // a giocare con un pezzo in meno.
  if (attack < ATTACK_ENOUGH && kingFromCentre(fen, color) >= 2) {
    found.push({ key: 'orientKingActive', params: {}, weight: 9 });
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
