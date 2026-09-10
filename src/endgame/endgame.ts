/**
 * Riconoscimento del finale tipico, e le risorse per studiarlo.
 *
 * Riconoscere che tipo di finale si ha davanti non richiede tabelle di finali ne'
 * motore ne' rete: basta la FIRMA DI MATERIALE letta dal FEN. "Torre e pedone contro
 * torre" e' un conteggio di pezzi, non una valutazione. Le tablebase servirebbero a
 * un'altra cosa — dire se la posizione e' vinta o patta — e sono state escluse per
 * scelta: questo programma non parla con la rete, e un link che l'utente clicca non
 * e' il programma che parla con la rete.
 *
 * Le risorse sono link curati a mano e verificati uno per uno. Non e' eleganza: i
 * link marciscono, e tenerli tutti in un posto solo fa si' che ripararli sia una riga
 * da cambiare invece di una caccia.
 *
 * Il criterio di scelta e' la QUALITA' DELLA FONTE, non la lingua. Decisione
 * dell'autore, e ha ragione: che l'interfaccia parli italiano e' una comodita', ma un
 * rimando tecnico deve puntare alla risorsa migliore che esiste, e per i finali quella
 * e' la Wikipedia inglese — le voci italiane, dove esistono, sono traduzioni parziali.
 * Da Lichess solo le lezioni UFFICIALI, che sono interattive, mai gli studi degli
 * utenti, che il proprietario puo' cancellare domani.
 */

import { Chess } from 'chess.js';

export interface EndgameResource {
  readonly label: string;
  readonly url: string;
  /** Vero se la risorsa e' interattiva: si gioca la posizione, non si legge. */
  readonly practice?: boolean;
}

export interface Endgame {
  /** Chiave i18n del nome del finale. */
  readonly key: string;
  readonly resources: readonly EndgameResource[];
  /**
   * Vero se vincerlo e' una TECNICA: una procedura che si impara una volta e poi si
   * esegue, non una posizione da giocare bene.
   *
   * Serve alla proposta di girare la scacchiera: ha senso dire "sapresti vincerla?"
   * solo dove la risposta e' insegnabile in mezz'ora. "Finale di Torri" e' vinto o
   * perso a seconda di dove stanno i Pedoni, e proporlo come esercizio vorrebbe dire
   * proporre di giocare meglio, che non e' un esercizio: e' tutto il gioco.
   */
  readonly technical?: boolean;
}

const WIKI_EN = 'https://en.wikipedia.org/wiki/';
const PRACTICE = 'https://lichess.org/practice/';

/** Conteggio dei pezzi di un colore, per tipo. */
interface Count {
  p: number;
  n: number;
  b: number;
  r: number;
  q: number;
  /** Alfieri su casa chiara e su casa scura: serve per i colori contrari. */
  lightBishops: number;
  darkBishops: number;
}

function emptyCount(): Count {
  return { p: 0, n: 0, b: 0, r: 0, q: 0, lightBishops: 0, darkBishops: 0 };
}

/**
 * Conta il materiale dalla disposizione del FEN. Si legge il primo campo e basta:
 * tratto, arrocchi e contatori non c'entrano con il tipo di finale.
 */
export function countMaterial(fen: string): { white: Count; black: Count } {
  const board = fen.split(' ')[0] ?? '';
  const white = emptyCount();
  const black = emptyCount();
  let file = 0;
  let rank = 7;
  for (const character of board) {
    if (character === '/') {
      rank--;
      file = 0;
      continue;
    }
    if (character >= '1' && character <= '8') {
      file += Number(character);
      continue;
    }
    const side = character === character.toUpperCase() ? white : black;
    const type = character.toLowerCase();
    if (type === 'p') side.p++;
    else if (type === 'n') side.n++;
    else if (type === 'r') side.r++;
    else if (type === 'q') side.q++;
    else if (type === 'b') {
      side.b++;
      // Casa chiara se la somma di colonna e traversa e' dispari: e' la convenzione
      // che rende h1 (0+0) scura, come sulla scacchiera vera.
      if ((file + rank) % 2 === 1) side.lightBishops++;
      else side.darkBishops++;
    }
    file++;
  }
  return { white, black };
}

function pieces(count: Count): number {
  return count.n + count.b + count.r + count.q;
}

function total(count: Count): number {
  return pieces(count) + count.p;
}

/** La firma "KRPvKR" e simili, sempre dal lato con piu' materiale. */
function signature(strong: Count, weak: Count): string {
  const letters = (c: Count): string =>
    'K' + 'Q'.repeat(c.q) + 'R'.repeat(c.r) + 'B'.repeat(c.b) + 'N'.repeat(c.n) + 'P'.repeat(c.p);
  return `${letters(strong)}v${letters(weak)}`;
}

/**
 * Tipi riconosciuti per firma esatta, in ordine di specificita'.
 *
 * Il criterio di ammissione: un finale entra solo se ha un NOME e una tecnica che si
 * puo' studiare. "Torre e due pedoni contro torre e pedone" non e' un finale tipico,
 * e' una posizione: verrebbe classificato dalla regola generica dei finali di torre.
 */
const BY_SIGNATURE: Record<string, Endgame> = {
  KPvK: {
    key: 'egKPvK',
    technical: true,
    resources: [
      { label: 'Wikipedia', url: `${WIKI_EN}King_and_pawn_versus_king_endgame` },
      { label: 'Lichess: opposition', url: `${PRACTICE}pawn-endgames/opposition/A4ujYOer`, practice: true },
      { label: 'Lichess: key squares', url: `${PRACTICE}pawn-endgames/key-squares/xebrDvFe`, practice: true },
      { label: 'Wikipedia: opposition', url: `${WIKI_EN}Opposition_(chess)` },
    ],
  },
  KQvK: {
    key: 'egKQvK',
    technical: true,
    resources: [
      { label: 'Lichess: basic checkmates', url: `${PRACTICE}checkmates/piece-checkmates-i/BJy6fEDf`, practice: true },
    ],
  },
  KRvK: {
    key: 'egKRvK',
    technical: true,
    resources: [
      { label: 'Lichess: basic checkmates', url: `${PRACTICE}checkmates/piece-checkmates-i/BJy6fEDf`, practice: true },
    ],
  },
  KBNvK: {
    key: 'egKBNvK',
    technical: true,
    resources: [
      { label: 'Lichess: bishop and knight', url: `${PRACTICE}checkmates/knight-bishop-mate/ByhlXnmM`, practice: true },
      { label: 'Wikipedia', url: `${WIKI_EN}Bishop_and_knight_checkmate` },
    ],
  },
  KNNvK: {
    key: 'egKNNvK',
    resources: [{ label: 'Wikipedia', url: `${WIKI_EN}Two_knights_endgame` }],
  },
  KBBvK: {
    key: 'egKBBvK',
    technical: true,
    resources: [
      { label: 'Lichess: basic checkmates', url: `${PRACTICE}checkmates/piece-checkmates-i/BJy6fEDf`, practice: true },
    ],
  },
  KQvKP: {
    key: 'egKQvKP',
    technical: true,
    resources: [{ label: 'Wikipedia', url: `${WIKI_EN}Queen_versus_pawn_endgame` }],
  },
  KRPvKR: {
    key: 'egKRPvKR',
    technical: true,
    resources: [
      { label: 'Wikipedia: Lucena position', url: `${WIKI_EN}Lucena_position` },
      { label: 'Wikipedia: Philidor position', url: `${WIKI_EN}Philidor_position` },
      { label: 'Lichess: rook endgames', url: `${PRACTICE}rook-endgames/basic-rook-endgames/pqUSUw8Y`, practice: true },
      { label: 'Wikipedia: the full theory', url: `${WIKI_EN}Rook_and_pawn_versus_rook_endgame` },
    ],
  },
  KRBvKR: {
    key: 'egKRBvKR',
    resources: [{ label: 'Wikipedia', url: `${WIKI_EN}Rook_and_bishop_versus_rook_endgame` }],
  },
  KQPvKQ: {
    key: 'egKQPvKQ',
    resources: [{ label: 'Wikipedia', url: `${WIKI_EN}Queen_and_pawn_versus_queen_endgame` }],
  },
};

/** Quanti pezzi (pedoni esclusi) si possono avere e parlare ancora di "finale". */
const ENDGAME_PIECES = 4;

/**
 * Che finale e' questo, se e' un finale.
 *
 * Restituisce null quando non c'e' niente di tipico da dire: e' l'esito piu' comune e
 * va bene cosi'. Dire "sei in un finale di pedoni" in ogni partita che arriva alla
 * mossa 40 sarebbe rumore, non didattica.
 */
export function classifyEndgame(fen: string): Endgame | null {
  const { white, black } = countMaterial(fen);
  const [strong, weak] = total(white) >= total(black) ? [white, black] : [black, white];

  const exact = BY_SIGNATURE[signature(strong, weak)];
  if (exact) return exact;

  // Da qui in giu' i finali "di genere". Si parla di finale solo se le donne sono
  // sparite e i pezzi sono pochi: con le donne in campo la partita e' ancora
  // mediogioco, per quanto materiale sia stato cambiato.
  if (white.q + black.q > 0) return null;
  if (pieces(white) + pieces(black) > ENDGAME_PIECES) return null;

  // Alfieri di colore contrario: uno per parte, su colori diversi. E' la regola con
  // il valore pratico piu' alto di tutte — cambia il modo di giocare la posizione,
  // perche' un pedone in piu' spesso non basta piu' a vincere.
  if (
    white.b === 1 &&
    black.b === 1 &&
    white.n + black.n + white.r + black.r === 0 &&
    white.lightBishops !== black.lightBishops
  ) {
    return {
      key: 'egOppositeBishops',
      resources: [{ label: 'Wikipedia', url: `${WIKI_EN}Opposite-coloured_bishops_endgame` }],
    };
  }

  // Finale di pedoni: solo re e pedoni. Il piu' concreto di tutti, perche' ogni
  // mossa e' irreversibile e un errore non si rimedia.
  if (pieces(white) + pieces(black) === 0 && white.p + black.p > 0) {
    return {
      key: 'egPawns',
      resources: [
        { label: 'Lichess: opposition', url: `${PRACTICE}pawn-endgames/opposition/A4ujYOer`, practice: true },
        { label: 'Lichess: key squares', url: `${PRACTICE}pawn-endgames/key-squares/xebrDvFe`, practice: true },
        { label: 'Wikipedia', url: `${WIKI_EN}Pawn_endgame` },
        { label: 'Wikipedia: passed pawn', url: `${WIKI_EN}Passed_pawn` },
      ],
    };
  }

  // Finale di torri: il piu' frequente della pratica, e quello che si sbaglia di piu'.
  if (white.r + black.r > 0 && white.n + black.n + white.b + black.b === 0) {
    return {
      key: 'egRooks',
      resources: [
        { label: 'Lichess: rook endgames', url: `${PRACTICE}rook-endgames/basic-rook-endgames/pqUSUw8Y`, practice: true },
        { label: 'Lichess: intermediate rook endings', url: `${PRACTICE}rook-endgames/intermediate-rook-endings/heQDnvq7`, practice: true },
        { label: 'Wikipedia: Lucena position', url: `${WIKI_EN}Lucena_position` },
        { label: 'Wikipedia: Philidor position', url: `${WIKI_EN}Philidor_position` },
      ],
    };
  }

  return null;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * I finali tipici a cui si puo' arrivare da qui con la prossima mossa, SENZA regalare
 * materiale.
 *
 * Si guarda la mossa e, se e' una cattura, anche la ripresa avversaria sulla stessa
 * casa: un cambio sono due semi-mosse. Ma un finale conta solo se per arrivarci non si
 * da' piu' di quanto si prende — pedone 1, pezzi leggeri 3, Torre 5, Donna 9.
 *
 * Senza questa condizione la regola chiamava "cambio" anche un regalo: l'Alfiere dato
 * per un pedone, se dopo restava un finale di Torri, veniva annunciato come una strada
 * da considerare. A un principiante un annuncio cosi' suggerisce di giocarla.
 *
 * Restano dentro tre cose diverse, e vanno bene tutte e tre: il cambio alla pari da
 * iniziare, la ripresa di un pezzo appena preso (in una partita vera: la Donna presa
 * in c6 e la Torre che la riprende), e la cattura che vince materiale. I sacrifici
 * restano fuori per ora: quelli che portano a un finale vinto esistono, ma
 * distinguerli da quelli che perdono chiede il motore, non un conto di pezzi.
 *
 * Da una posizione che e' GIA' un finale tipico non si annuncia niente.
 */
export function reachableEndgames(fen: string): Endgame[] {
  if (classifyEndgame(fen)) return [];
  const start = new Chess(fen);
  if (start.isGameOver()) return [];
  const found = new Map<string, Endgame>();
  for (const move of start.moves({ verbose: true })) {
    const after = new Chess(fen);
    after.move(move.san);
    const mine = VALUE[move.promotion ?? move.piece] ?? 0;
    const gain = move.captured ? (VALUE[move.captured] ?? 0) : 0;
    const replies = after.moves({ verbose: true }).filter((reply) => reply.to === move.to);
    // Il finale subito dopo la mossa: vale se il pezzo non puo' essere ripreso, o se
    // anche ripreso la cattura non costa niente.
    const direct = classifyEndgame(after.fen());
    if (direct && gain - (replies.length > 0 ? mine : 0) >= 0) found.set(direct.key, direct);
    if (!move.captured || gain - mine < 0) continue;
    for (const reply of replies) {
      const traded = new Chess(after.fen());
      traded.move(reply.san);
      const endgame = classifyEndgame(traded.fen());
      if (endgame) found.set(endgame.key, endgame);
    }
  }
  return [...found.values()];
}
