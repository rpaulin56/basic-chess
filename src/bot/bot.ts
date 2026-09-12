import type { Analysis, EngineLine } from '../engine/types.js';
import { winPercentOf } from '../engine/winProb.js';

/**
 * Il bot "addomesticato".
 *
 * Perche' non UCI_LimitStrength: Stockfish indebolito con quel meccanismo parte da
 * ~1320 Elo e soprattutto sbaglia in modo DISUMANO — gioca quasi sempre da maestro e
 * ogni tanto lascia un pezzo senza ragione. Un principiante non impara nulla contro
 * un avversario cosi': non ci sono piani da capire, solo regali da aspettare.
 *
 * Qui invece si chiede al motore le N mosse migliori a profondita' bassa e si sceglie
 * fra quelle con un campionamento pesato: le mosse che perdono poco restano probabili,
 * quelle che perdono molto diventano improbabili ma non impossibili. Il risultato e'
 * un avversario che gioca mosse SENSATE ma non ottimali — cioe' come un umano debole.
 *
 * Questo modulo e' una funzione pura con generatore casuale iniettabile: e' quello che
 * permette allo script di calibrazione di farlo giocare contro se stesso migliaia di
 * volte in modo riproducibile.
 */

export interface BotLevel {
  readonly id: string;
  /**
   * Elo MISURATO, uno per grado di attenzione: la distrazione e' un asse a se' e
   * sposta la forza quanto e piu' di un gradino di bravura, quindi un numero solo
   * sarebbe una bugia per meta' delle combinazioni.
   */
  readonly elo: { readonly attento: number; readonly distratto: number };
  /** Profondita' di ricerca: il primo e piu' grossolano regolatore di forza. */
  readonly depth: number;
  /** Quante alternative considerare. Sotto 3 il campionamento non ha spazio. */
  readonly multiPV: number;
  /**
   * "Temperatura" in punti percentuali di probabilita' di vittoria: quanto costa a
   * una mossa, in probabilita' di essere scelta, il fatto di perdere terreno.
   * Bassa = quasi sempre la mossa migliore. Alta = sceglie spesso alternative scadenti.
   */
  readonly temperature: number;
  /**
   * Da quale vantaggio (in pedoni) la partita conta come "decisa", e il bot smette di
   * sbagliare apposta. Assente = la soglia normale.
   *
   * E' per livello perche' la disciplina delle posizioni decise ALZA IL PAVIMENTO
   * della scala: misurato, togliere le papere quando la partita e' decisa ha portato
   * "principiante" da 690 a 903 Elo, perche' erano proprio i livelli deboli a buttare
   * via le partite gia' vinte. Un giocatore da 700 punti, per definizione, le butta
   * via. Alzando la soglia per i livelli bassi si tiene quello che serve — nessuna
   * mossa assurda quando la posizione e' senza speranza — e si restituisce loro il
   * diritto di essere approssimativi quando il vantaggio e' solo grosso.
   */
  readonly decidedPawns?: number;
  /**
   * Quanto puo' costare al massimo una mossa campionata. Assente = la soglia normale.
   *
   * E' PER LIVELLO, e non poteva essere altrimenti. Un tetto unico e stretto rende
   * impossibile il fondo della scala: misurato, con quindici punti per tutti il
   * "principiante" passava dal 5% al 25% contro l'ancoraggio a 1320, cioe' da ~870 a
   * ~1130 Elo, e un avversario da mille e cento non e' un avversario per chi comincia.
   *
   * Il motivo e' che le due cose sono in conflitto per davvero: un giocatore da 800
   * punti REGALA materiale, e un avversario che non lo fa mai non e' un giocatore da
   * 800 punti. Quindi il tetto non e' una promessa di correttezza uguale per tutti —
   * e' un parametro di forza, e sta qui insieme agli altri.
   */
  readonly maxCost?: number;
}

/**
 * Quanto le mosse di teoria tirano la scelta, in partita normale.
 *
 * NON e' un libro: la Nonna continua a scegliere fra le mosse del motore come sempre, e
 * quelle che si giocano davvero pesano un po' di piu'. Il moltiplicatore va con la RADICE
 * della quota, cosi' la differenza fra il 64% e il 23% si sente ma non schiaccia: alla
 * prima mossa 1.e4 pesa circa due volte e mezzo una mossa qualunque, 1.d4 circa due, e
 * 1.a3 resta possibile — raro, come dev'essere.
 *
 * Seguire il libro alla lettera, con le proporzioni di Lichess, la Nonna lo fa soltanto in
 * modalita' "studia aperture": li' si vuole la teoria, non un'avversaria.
 */
const BOOK_PULL = 2;

/**
 * I CINQUE livelli, con l'Elo misurato contro Stockfish limitato a un Elo noto.
 *
 * Erano sette, e i sette erano una bugia gentile: misurando i livelli UNO CONTRO
 * L'ALTRO — cosa che per mesi non avevamo mai fatto — due "gradini" si sono rivelati
 * inesistenti. Fra il vecchio 6 e il 7 c'erano 89 punti, cioe' il 7 vinceva il 62%
 * delle partite contro il 6; fra il 4 e il 5 ce n'erano 154. In compenso fra il 3 e
 * il 4 ce n'erano 458. Il gradino piu' largo valeva cinque volte il piu' stretto, e
 * dalle etichette non si vedeva.
 *
 * DUE MISURE DIVERSE PER DUE DOMANDE DIVERSE. E' la lezione di questa taratura, e
 * vale oltre gli scacchi. L'ancoraggio a Stockfish dice "quanto vale questo livello
 * nel mondo", ed e' il numero da stampare perche' e' l'unico confrontabile con
 * qualcosa. Il confronto interno dice "quanto si sente il salto da qui al prossimo",
 * ed e' quello che l'utente vive davvero. Le configurazioni si PROGETTANO col secondo
 * e si ETICHETTANO col primo.
 *
 * I gradini misurati fra livelli adiacenti, 60 partite ciascuno:
 *
 *   1 -> 2   382 punti (il piu' debole raccoglie il 10,0%)
 *   2 -> 3   250 punti (19,2%)
 *   3 -> 4   290 punti (15,8%)
 *   4 -> 5   338 punti (12,5%)
 *
 * Da 5,1 a 1,5 nel rapporto fra il gradino piu' largo e il piu' stretto. Non si e'
 * andati oltre perche' l'incertezza su ognuna di queste misure e' +-55: inseguire una
 * regolarita' migliore sarebbe inseguire rumore. E fra bot con profili cosi' diversi
 * l'Elo non e' nemmeno transitivo — una scala perfettamente regolare non esiste.
 *
 * L'Elo ancorato, 100 partite per combinazione:
 *
 *   livello   attenta   distratta   ancoraggio   punteggio (attenta)
 *   1             857         808         1320    6,5%
 *   2            1275        1189         1320   43,5%
 *   3            1602        1511         1320   83,5%
 *   4            1807        1636         1800   51,0%
 *   5            2123        1915         1800   86,5%
 *
 * I due numeri piu' affidabili sono il 1275 e il 1807, che vengono da punteggi del
 * 43,5% e del 51,0%: li' cento partite misurano davvero. L'857 viene da un 6,5% ed e'
 * un'estrapolazione — Stockfish non scende sotto 1320 con UCI_Elo, quindi il fondo
 * della scala non si puo' misurare meglio di cosi'.
 *
 * COSA REGOLA COSA, misurato:
 *  - PROFONDITA': il regolatore principale, ma quantizzato a gradini troppo larghi per
 *    costruirci una scala da solo (una semi-mossa in piu' vale 250-450 punti).
 *  - TEMPERATURA: il regolatore FINE, quello che interpola dentro una profondita'. E'
 *    grazie a lei che i quattro gradini sono venuti quasi uguali al primo tentativo.
 *  - TETTO al costo: quanto materiale la Nonna puo' regalare fra le mosse che VEDE.
 *    Largo in basso e stretto in alto, perche' un giocatore da 800 punti regala
 *    materiale — un avversario che non lo fa mai non e' un giocatore da 800 punti.
 *  - DISTRAZIONE: 50-170 punti, sempre nello stesso verso in tutte e cinque le righe.
 *  - Controintuitivo e verificato: meno scelte e tetto piu' stretto significano piu'
 *    DETERMINISMO, e a questi livelli il determinismo vale piu' della vista. E' il
 *    motivo per cui il vecchio livello 7 stava 320 punti sopra il 6 pur avendo la
 *    stessa profondita' e la stessa temperatura.
 *
 * Ogni modifica al modo in cui il bot sceglie le mosse invalida la scala e va seguita
 * da una rimisurazione: questi numeri sono un risultato sperimentale, non una scelta.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  // I tre parametri si muovono INSIEME lungo la scala: ad ogni gradino la Nonna vede
  // una semi-mossa piu' in la', considera meno alternative, ed e' meno disposta a
  // sceglierne una peggiore. Nella vecchia scala non era vero — il livello 1 e il 2
  // differivano solo per la temperatura, il 6 e il 7 solo per la profondita' — ed e'
  // una delle ragioni per cui i gradini erano irregolari.
  //
  // I due piu' bassi hanno anche la soglia del "decisa" piu' alta: la disciplina
  // scatta solo quando la posizione e' senza speranza, cosi' non fanno mosse assurde a
  // meno sette ma restano liberi di essere approssimativi quando il vantaggio e'
  // soltanto grosso. E' cio' che li rende avversari credibili per chi comincia.
  { id: 'l1', elo: { attento: 857, distratto: 808 }, depth: 2, multiPV: 8, temperature: 45, decidedPawns: 6, maxCost: 45 },
  { id: 'l2', elo: { attento: 1275, distratto: 1189 }, depth: 3, multiPV: 6, temperature: 40, decidedPawns: 5, maxCost: 30 },
  { id: 'l3', elo: { attento: 1602, distratto: 1511 }, depth: 4, multiPV: 5, temperature: 36, maxCost: 24 },
  { id: 'l4', elo: { attento: 1807, distratto: 1636 }, depth: 5, multiPV: 5, temperature: 18, maxCost: 14 },
  { id: 'l5', elo: { attento: 2123, distratto: 1915 }, depth: 6, multiPV: 4, temperature: 13, maxCost: 10 },
];

/**
 * Da sette livelli a cinque: dove finisce chi aveva scelto uno di quelli spariti.
 *
 * Senza questa tabella tutti si ritroverebbero al livello centrale, e chi giocava
 * contro il piu' debole si troverebbe davanti un'avversaria di quattrocento punti piu'
 * forte senza aver toccato niente. Ognuno viene portato al livello NUOVO piu' vicino
 * per forza MISURATA a quello che aveva, non a quello con lo stesso numero: e infatti
 * non e' una corrispondenza uno a uno, perche' i vecchi 1 e 2 distavano meno di un
 * gradino nuovo e finiscono insieme, come il 6 e il 7.
 */
const RETIRED_LEVELS: Record<string, string> = {
  principiante: 'l1',
  facile: 'l1',
  medio: 'l2',
  discreto: 'l3',
  club: 'l4',
  esperto: 'l5',
  forte: 'l5',
};

export function levelById(id: string): BotLevel {
  const wanted = RETIRED_LEVELS[id] ?? id;
  return BOT_LEVELS.find((level) => level.id === wanted) ?? BOT_LEVELS[1]!;
}

/**
 * Quanto e' distratto l'avversario: un asse SEPARATO dalla bravura.
 *
 * Sono due cose diverse e vanno scelte separatamente. La bravura (profondita' e
 * temperatura) produce errori SPIEGABILI e PUNIBILI: il bot non ha visto abbastanza
 * lontano, come un giocatore debole vero, e tu che calcoli una mossa in piu' lo
 * batti. La distrazione produce regali: non insegnano a calcolare, insegnano ad
 * aspettare — ma insegnano l'altra meta' del mestiere, cioe' accorgersi dell'errore
 * altrui e punirlo, che e' un'abilita' vera e che nessun avversario perfetto allena.
 *
 * Due gradi e non tre: la differenza fra "una papera ogni venti mosse" e "una ogni
 * otto" sta dentro il rumore della calibrazione (±64 punti su 30 partite), e
 * un'impostazione che non si riesce a misurare e' precisione finta.
 */
export type DistractionId = 'attento' | 'distratto';

export interface Distraction {
  readonly id: DistractionId;
  /**
   * Probabilita' di una svista vera e propria: sceglie deliberatamente la PEGGIORE
   * fra le alternative considerate. Non e' una mossa a caso fra tutte le legali —
   * chi sbaglia gioca comunque una mossa che gli sembrava sensata.
   */
  readonly blunderRate: number;
}

export const DISTRACTIONS: readonly Distraction[] = [
  { id: 'attento', blunderRate: 0 },
  // Una ogni dieci mosse: due o tre a partita. Il vecchio "principiante" ne faceva
  // una su tre, che non e' un avversario distratto ma un generatore di regali.
  { id: 'distratto', blunderRate: 0.1 },
];

export function distractionById(id: string): Distraction {
  return DISTRACTIONS.find((entry) => entry.id === id) ?? DISTRACTIONS[0]!;
}

export type Rng = () => number;

/**
 * Valutazione in centipawn "estesa": un matto diventa un numero grandissimo, tanto
 * piu' grande quanto piu' e' vicino. Serve perche' altrimenti tutti i matti si
 * equivalgono e il bot puo' preferire il matto in 8 a quello in 1.
 */
function extendedCp(line: EngineLine): number {
  if (line.mateIn === null) return line.scoreCp ?? 0;
  return line.mateIn > 0 ? 100_000 - line.mateIn * 100 : -100_000 - line.mateIn * 100;
}

/**
 * Quanti centipawn valgono un punto di costo. Con 10, in posizione equilibrata il
 * termine in centipawn e' quasi identico a quello in aspettativa (100 cp valgono
 * circa 9 punti di aspettativa attorno alla parita'): i due criteri si saldano senza
 * gradini.
 */
const CP_PER_POINT = 10;

/**
 * Oltre questo vantaggio (in pedoni) la partita e' decisa, e il bot cambia registro.
 */
const DECIDED_PAWNS = 3;

/**
 * Quanto puo' costare al massimo una mossa in posizione decisa. Oltre, la mossa non
 * viene proprio considerata.
 *
 * E' un filtro netto e non un peso, e la differenza e' il punto. In una posizione
 * decisa le valutazioni si COMPRIMONO: misurato su una partita reale, con il Nero a
 * meno sette, lasciare una torre in presa costava mezzo pedone di valutazione, perche'
 * tanto si perde comunque. Il campionamento esponenziale traduceva quel mezzo pedone
 * in "una volta su cinque", e una volta su cinque il bot lasciava la torre — che e'
 * l'unica cosa che uno che guarda non perdona, perche' e' assurda anche a mille punti
 * Elo di distanza.
 *
 * Cinque punti valgono mezzo pedone: sopra quella soglia non c'e' piu' "una mossa
 * leggermente peggiore", c'e' materiale regalato.
 */
const DECIDED_MAX_COST = 5;

/**
 * Tetto al costo di una mossa CAMPIONATA, anche a partita aperta.
 *
 * Nasce da una misura, non da un'intuizione. Al livello 4 (temperatura 22), in una
 * posizione con la ricattura obbligata di un Cavallo, il campionamento dava questo:
 *
 *   dxe5  costo  0.0  ->  43,9%      <- la ricattura
 *   Kd2   costo 20.3  ->  17,5%
 *   b3    costo 23.6  ->  15,0%
 *   f3    costo 26.7  ->  13,1%
 *   g3    costo 31.4  ->  10,5%
 *
 * Cinquantasei volte su cento non ricatturava. E la distrazione non c'entrava:
 * "attenta" azzera solo la papera deliberata, mentre il dado del campionamento si
 * tira comunque e non aveva alcun limite. La promessa che l'applicazione fa
 * all'utente — "ATTENTA non regala niente: sbaglia solo per non aver visto
 * abbastanza lontano" — era quindi falsa.
 *
 * Quindici punti valgono un pedone e mezzo: sotto quella soglia c'e' ancora tutto lo
 * spazio per giocare una mossa peggiore, sopra si sta regalando materiale.
 *
 * Va letto per quello che e': il tetto vale su cio' che il bot VEDE alla sua
 * profondita'. Un livello basso continuera' a perdere pezzi per non aver guardato
 * abbastanza avanti — che e' esattamente il modo in cui deve sbagliare.
 */
const MAX_COST = 15;

/**
 * Quanto costa una mossa rispetto alla migliore.
 *
 * Il massimo fra due misure, e non e' un dettaglio: l'aspettativa di vittoria e'
 * quella giusta per giudicare gli ERRORI di un umano (da +9 a +7 non cambia nulla) ma
 * e' pessima per SCEGLIERE una mossa in posizione decisa, perche' satura. Misurato:
 * fra +18 e +10 — una donna intera — l'aspettativa distingue 2,3 punti, cioe' quasi
 * nulla, e il bot finiva per sorteggiare fra le linee. E' esattamente il difetto per
 * cui non prendeva le donne in presa quando stava perdendo o vincendo largamente.
 *
 * Il termine in centipawn non satura mai e riprende in mano la scelta appena
 * l'aspettativa smette di dire qualcosa.
 */
function moveCost(best: EngineLine, line: EngineLine): number {
  const byExpectancy = winPercentOf(best) - winPercentOf(line);
  const byCentipawns = (extendedCp(best) - extendedCp(line)) / CP_PER_POINT;
  return Math.max(0, Math.max(byExpectancy, byCentipawns));
}

/**
 * La partita e' decisa? Serve anche fuori di qui: quando lo e', il bot cerca piu' a
 * fondo prima di scegliere (vedi play.ts).
 */
export function isDecided(analysis: Analysis, level?: BotLevel): boolean {
  const best = analysis.lines.find((line) => line.pv.length > 0);
  const threshold = level?.decidedPawns ?? DECIDED_PAWNS;
  return best ? Math.abs(extendedCp(best)) / 100 >= threshold : false;
}

/**
 * Sceglie la mossa del bot fra le linee analizzate.
 * Restituisce una mossa in notazione UCI, o null se non c'e' nulla da giocare.
 */
export function selectBotMove(
  analysis: Analysis,
  level: BotLevel,
  distraction: Distraction,
  rng: Rng = Math.random,
  /**
   * Quanto e' giocata una mossa (0-100), per dare una spinta alla teoria. Vedi BOOK_PULL.
   * Senza, si sceglie come si e' sempre scelto.
   */
  bookShare: (uci: string) => number = () => 0,
): string | null {
  const all = analysis.lines.filter((line) => line.pv.length > 0);
  if (all.length === 0) return analysis.bestMove;
  if (all.length === 1) return all[0]!.pv[0]!;

  const best = all[0]!;

  // Partita decisa: il bot stringe i denti, con meno casualita' e molte meno papere.
  //
  // E' una deviazione DELIBERATA dal realismo, chiesta e motivata: portare a termine
  // una posizione vinta e' fra le cose piu' difficili da imparare, e allenarsi contro
  // un avversario che le butta via non insegna niente. Vale anche a parti rovesciate,
  // perche' un bot che perde e per giunta smette di prendere i pezzi in presa e'
  // semplicemente sgradevole da guardare.
  const decided = Math.abs(extendedCp(best)) / 100 >= (level.decidedPawns ?? DECIDED_PAWNS);
  const temperature = decided ? level.temperature * 0.4 : level.temperature;

  // Le mosse troppo costose si scartano del tutto invece di renderle solo
  // improbabili: e' l'unico modo di far sparire il regalo di materiale, perche' il
  // campionamento esponenziale una probabilita' la lascia sempre. Il tetto e' piu'
  // stretto in posizione decisa, dove la valutazione si comprime e mezzo pedone di
  // scarto puo' voler dire una torre.
  //
  // Almeno una linea sopravvive sempre: la migliore costa zero per definizione.
  const ceiling = decided ? DECIDED_MAX_COST : (level.maxCost ?? MAX_COST);
  const lines = all.filter((line) => moveCost(best, line) <= ceiling);

  // La svista: la peggiore fra le alternative CONSIDERATE, non una mossa a caso fra
  // tutte le legali. Un principiante che sbaglia gioca comunque una mossa che gli
  // sembrava sensata, non una mossa assurda.
  //
  // A partita decisa la svista sparisce del tutto: e' li' che il bot deve stringere i
  // denti, e una papera gratuita mentre si converte (o si resiste) e' esattamente
  // cio' che rende inutile l'allenamento.
  // La papera pesca fra TUTTE le candidate e non fra quelle sopravvissute al tetto:
  // e' il suo mestiere regalare qualcosa, ed e' cio' che tiene i due assi separati e
  // leggibili. Il livello dice quanto lontano vede la Nonna; la distrazione dice
  // quanto spesso regala qualcosa apposta. Il campionamento non deve fare ne' l'una
  // ne' l'altra cosa.
  if (!decided && rng() < distraction.blunderRate) {
    return all[all.length - 1]!.pv[0]!;
  }

  const weights = lines.map((line) => {
    const chance = Math.exp(-moveCost(best, line) / temperature);
    const share = Math.max(0, Math.min(100, bookShare(line.pv[0]!)));
    return chance * (1 + BOOK_PULL * Math.sqrt(share / 100));
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let threshold = rng() * total;
  for (let i = 0; i < lines.length; i++) {
    threshold -= weights[i]!;
    if (threshold <= 0) return lines[i]!.pv[0]!;
  }
  return lines[0]!.pv[0]!;
}
