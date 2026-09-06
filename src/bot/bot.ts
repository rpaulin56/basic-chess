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
}

/**
 * I livelli, con l'Elo MISURATO (non ipotizzato) da `npm run calibrate`, 30 partite per
 * livello contro Stockfish limitato a un Elo noto.
 *
 * Cosa ha insegnato la calibrazione, e che vale la pena non riscoprire:
 *  - la prima ipotesi era sbagliata di 400-500 punti: "profondita' 4" suona debole ma
 *    e' gia' un giocatore da oltre 1200. Fidarsi dei numeri a occhio non funziona.
 *  - TEMPERATURA e PAPERE hanno smesso di essere regolatori. Da quando il bot converte
 *    davvero le posizioni decise, cambiarle sposta meno del rumore di misura: "medio"
 *    da temperatura 30 a 40 e papere da 0.18 a 0.25 e' passato da 1237 a 1225, cioe'
 *    non si e' mosso. Restano nel modello perche' danno la GRANA delle mosse — un bot
 *    deterministico si riconosce dopo tre partite — non perche' regolino la forza.
 *  - la profondita' e' il regolatore vero, ma e' quantizzata e i gradini sono grossi:
 *    d2 ~900, d3 ~1230, d4 ~1300, d5 ~1500, d6 ~1840, d8 ~2260. Fra d3 e d4 la
 *    differenza sta dentro il rumore: senza altri parametri sarebbero lo stesso
 *    avversario con due nomi.
 *  - controintuitivo e verificato: la profondita' 1 e' PIU' FORTE della 2 (1113 contro
 *    903). A profondita' 1 contano quasi solo le catture, le valutazioni delle linee
 *    si separano molto, i costi diventano grandi e il campionamento si concentra sulla
 *    prima linea. Meno profondita' produce piu' determinismo, e a questi livelli il
 *    determinismo vale piu' della profondita'. Non usare d1 per fare un bot debole.
 *  - la disciplina delle posizioni decise ALZA IL PAVIMENTO della scala di circa 200
 *    punti, e colpisce soprattutto i livelli deboli, che erano quelli che buttavano
 *    via le partite gia' vinte. Ma un giocatore da 700 punti per definizione le butta
 *    via: non si possono avere insieme un avversario autenticamente da principianti e
 *    un bot che converte sempre. E' la stessa proprieta' con il segno opposto, ed e'
 *    il motivo per cui `decidedPawns` e' per livello.
 *
 * Ogni modifica al modo in cui il bot sceglie le mosse invalida la scala e va seguita
 * da una rimisurazione: i numeri qui sotto sono un risultato sperimentale, non una
 * scelta.
 *
 * Attenzione all'attendibilita'. Sotto i 1320 la stima e' un'ESTRAPOLAZIONE dal
 * punteggio, e ai livelli piu' bassi lo e' pesantemente: "principiante" ha fatto 0.5
 * punti su 30 contro l'ancoraggio, e da mezzo punto si ricava "612" con una barra
 * d'errore enorme. Prendere quei numeri come ordinamento, non come misura. Sopra vale
 * il problema simmetrico: i livelli forti si misurano contro un ancoraggio piu' alto
 * (1800), altrimenti vincono tutto e la stima e' aria fritta.
 *
 * Quanto e' ripetibile: "discreto" misurato su 20 partite ha dato 1467 e su 30 ne ha
 * dati 1297. Venti partite non bastano nemmeno a collocare un livello.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  // I tre livelli bassi hanno la soglia del "decisa" molto piu' alta: la disciplina
  // scatta solo quando la posizione e' senza speranza. Cosi' non fanno mosse assurde
  // a meno sette — la cosa che nessuno perdona — ma restano liberi di essere
  // approssimativi quando il vantaggio e' soltanto grosso, che e' cio' che li rende
  // avversari credibili per chi comincia.
  {
    id: 'principiante',
    elo: { attento: 968, distratto: 612 },
    depth: 2,
    multiPV: 8,
    temperature: 45,
    decidedPawns: 6,
  },
  {
    id: 'facile',
    elo: { attento: 968, distratto: 612 },
    depth: 2,
    multiPV: 8,
    temperature: 20,
    decidedPawns: 6,
  },
  {
    id: 'medio',
    elo: { attento: 1144, distratto: 938 },
    depth: 3,
    multiPV: 6,
    temperature: 20,
    decidedPawns: 5,
  },
  { id: 'discreto', elo: { attento: 1496, distratto: 1159 }, depth: 4, multiPV: 5, temperature: 22 },
  { id: 'club', elo: { attento: 1580, distratto: 1467 }, depth: 5, multiPV: 5, temperature: 16 },
  // Misurati contro l'ancoraggio a 1800, non a 1320: contro il piu' debole vincevano
  // quasi tutte le partite e la stima sarebbe stata solo un'estrapolazione senza senso.
  { id: 'esperto', elo: { attento: 1947, distratto: 1765 }, depth: 6, multiPV: 4, temperature: 13 },
  { id: 'forte', elo: { attento: 2508, distratto: 2152 }, depth: 8, multiPV: 3, temperature: 8 },
];


export function levelById(id: string): BotLevel {
  return BOT_LEVELS.find((level) => level.id === id) ?? BOT_LEVELS[2]!;
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

  // In posizione decisa si scartano del tutto le mosse che costano troppo, invece di
  // renderle solo improbabili: e' l'unico modo di far sparire il regalo di materiale,
  // perche' li' la valutazione non distingue piu' abbastanza da poterselo permettere.
  // Almeno una linea sopravvive sempre: la migliore costa zero per definizione.
  const lines = decided ? all.filter((line) => moveCost(best, line) <= DECIDED_MAX_COST) : all;

  // La svista: la peggiore fra le alternative CONSIDERATE, non una mossa a caso fra
  // tutte le legali. Un principiante che sbaglia gioca comunque una mossa che gli
  // sembrava sensata, non una mossa assurda.
  //
  // A partita decisa la svista sparisce del tutto: e' li' che il bot deve stringere i
  // denti, e una papera gratuita mentre si converte (o si resiste) e' esattamente
  // cio' che rende inutile l'allenamento.
  if (!decided && rng() < distraction.blunderRate) {
    return lines[lines.length - 1]!.pv[0]!;
  }

  const weights = lines.map((line) => Math.exp(-moveCost(best, line) / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let threshold = rng() * total;
  for (let i = 0; i < lines.length; i++) {
    threshold -= weights[i]!;
    if (threshold <= 0) return lines[i]!.pv[0]!;
  }
  return lines[0]!.pv[0]!;
}
