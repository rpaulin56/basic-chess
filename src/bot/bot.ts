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
 * I livelli, con l'Elo MISURATO da `npm run calibrate`, 100 partite per combinazione
 * contro Stockfish limitato a un Elo noto.
 *
 * QUANTO VALGONO QUESTI NUMERI. Cento partite, non trenta, e non e' pedanteria: con
 * trenta la stessa configurazione rimisurata dava scarti di 150-250 punti, e in una
 * sola giornata quel rumore ha prodotto tre conclusioni sbagliate — "discreto si e'
 * rafforzato a 1467" (era 1297), "la temperatura non regola piu' la forza" (regola,
 * ~150-270 punti), "principiante e facile sono lo stesso avversario" (non lo sono).
 * L'errore dichiarato dallo script (±64 su trenta partite) presuppone partite
 * indipendenti, e non lo sono: condividono seed e avversario. Anche a cento partite
 * due misure della stessa configurazione possono distare un centinaio di punti:
 * questi numeri sono un ORDINAMENTO affidabile e una misura approssimata.
 *
 * I livelli agli ESTREMI sono i meno attendibili: contro l'ancoraggio raccolgono
 * l'8% (i due piu' bassi) o il 93% (il piu' alto), e da un punteggio cosi' schiacciato
 * l'Elo si ricava per estrapolazione. Stockfish non scende sotto 1320 con UCI_Elo,
 * quindi per collocare meglio i primi servirebbe un confronto interno (`--vs`).
 *
 * MISURA DEL 2026-09-08, dopo l'introduzione del tetto al costo (100 partite per
 * combinazione; ancoraggio 1320 per i primi tre, 1800 per i tre successivi, 2200 per
 * l'ultimo):
 *
 *   livello        attenta   distratta      (prima del tetto)
 *   1 principiante     907         842       871 / 808
 *   2 facile          1012        1045       982 / 871
 *   3 medio           1373        1242      1282 / 1185
 *   4 discreto        1681        1595      1530 / 1435
 *   5 club            1817        1681      1722 / 1555
 *   6 esperto         2069        1919      1892 / 1860
 *   7 forte           2663        2391      2352 / 2236
 *
 * Il tetto ha spostato la scala verso l'alto in modo ORDINATO: quasi niente ai due
 * livelli piu' bassi, dove e' largo e non morde, e 150-300 punti dal quarto in su. E'
 * la misura di quanto valeva il materiale che il campionamento regalava gratis.
 *
 * Un'inversione: al livello 2 la distratta (1045) misura piu' dell'attenta (1012).
 * Trentatre' punti su cento partite sono dentro il rumore, e nelle altre sei righe il
 * verso e' sempre quello giusto — ma va lasciata scritta invece che aggiustata a mano,
 * o la tabella smette di essere una misura e diventa un'opinione.
 *
 * COSA REGOLA COSA, misurato:
 *  - PROFONDITA': il regolatore principale, ma quantizzato e a gradini grossi
 *    (d2 ~900, d3 ~1280, d4 ~1530, d5 ~1720, d6 ~1890, d8 ~2350).
 *  - TEMPERATURA: vale 100-270 punti a parita' di profondita' (d2: t45 = 871,
 *    t20 = 982 in una misura, 808 e 1074 in un'altra — il verso e' sempre lo stesso,
 *    la taglia e' incerta). Serve anche a dare varieta': senza, il bot ripete la
 *    stessa partita e lo si riconosce dopo tre.
 *  - DISTRAZIONE: ~100 punti in media (da 32 a 167), sempre nello stesso verso in
 *    tutte e sette le righe. La costanza del segno vale piu' della singola misura.
 *  - Controintuitivo e verificato: la profondita' 1 e' PIU' FORTE della 2 (1113
 *    contro 903). A profondita' 1 contano quasi solo le catture, le valutazioni delle
 *    linee si separano molto, i costi diventano grandi e il campionamento si
 *    concentra sulla prima linea. Meno profondita' produce piu' determinismo, e a
 *    questi livelli il determinismo vale piu' della vista.
 *  - La disciplina delle posizioni decise ALZA IL PAVIMENTO della scala, e colpisce
 *    soprattutto i livelli deboli, che erano quelli che buttavano via le partite gia'
 *    vinte. Ma un giocatore da 700 punti per definizione le butta via: non si possono
 *    avere insieme un avversario autenticamente da principianti e un bot che converte
 *    sempre. E' il motivo per cui `decidedPawns` e' per livello.
 *
 * Ogni modifica al modo in cui il bot sceglie le mosse invalida la scala e va seguita
 * da una rimisurazione: questi numeri sono un risultato sperimentale, non una scelta.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  // I tre livelli bassi hanno la soglia del "decisa" molto piu' alta: la disciplina
  // scatta solo quando la posizione e' senza speranza. Cosi' non fanno mosse assurde
  // a meno sette — la cosa che nessuno perdona — ma restano liberi di essere
  // approssimativi quando il vantaggio e' soltanto grosso, che e' cio' che li rende
  // avversari credibili per chi comincia.
  {
    id: 'principiante',
    elo: { attento: 907, distratto: 842 },
    depth: 2,
    multiPV: 8,
    temperature: 45,
    decidedPawns: 6,
    maxCost: 45,
  },
  {
    id: 'facile',
    elo: { attento: 1012, distratto: 1045 },
    depth: 2,
    multiPV: 8,
    temperature: 20,
    decidedPawns: 6,
    maxCost: 35,
  },
  {
    id: 'medio',
    elo: { attento: 1373, distratto: 1242 },
    depth: 3,
    multiPV: 6,
    temperature: 20,
    decidedPawns: 5,
    maxCost: 25,
  },
  { id: 'discreto', elo: { attento: 1681, distratto: 1595 }, depth: 4, multiPV: 5, temperature: 22 },
  { id: 'club', elo: { attento: 1817, distratto: 1681 }, depth: 5, multiPV: 5, temperature: 16, maxCost: 12 },
  // Misurati contro l'ancoraggio a 1800, non a 1320: contro il piu' debole vincevano
  // quasi tutte le partite e la stima sarebbe stata solo un'estrapolazione senza senso.
  { id: 'esperto', elo: { attento: 2069, distratto: 1919 }, depth: 6, multiPV: 4, temperature: 13, maxCost: 10 },
  { id: 'forte', elo: { attento: 2663, distratto: 2391 }, depth: 8, multiPV: 3, temperature: 8, maxCost: 8 },
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

  const weights = lines.map((line) => Math.exp(-moveCost(best, line) / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let threshold = rng() * total;
  for (let i = 0; i < lines.length; i++) {
    threshold -= weights[i]!;
    if (threshold <= 0) return lines[i]!.pv[0]!;
  }
  return lines[0]!.pv[0]!;
}
