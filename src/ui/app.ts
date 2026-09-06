import { Chess, type Square } from 'chess.js';
import {
  currentFen,
  gameOver,
  goTo,
  hasFuture,
  newGame,
  playMove,
  positionAt,
  truncateHere,
  type Color,
  type GameState,
} from '../core/game.js';
import { parseGameInput } from '../core/import.js';
import { toFigurine } from '../core/notation.js';
import { ANNOTATION_TAG, toPgn } from '../core/pgn.js';
import { BOT_LEVELS, levelById, type BotLevel } from '../bot/bot.js';
import { chooseBotMove } from '../bot/play.js';
import { formatScore } from '../engine/winProb.js';
import type { Analysis, EngineLine } from '../engine/types.js';
import { detectMistake, isImportant, type MistakeVerdict } from '../tutor/detect.js';
import { classifyConsequence, transportArrows, type Consequence } from '../tutor/classify.js';
import { explainPositional, type Explanation } from '../tutor/positional.js';
import { findContinuations, findOpening, type Opening } from '../openings/openings.js';
import { buildHint } from '../tutor/hint.js';
import { orientPosition } from '../tutor/orientation.js';
import { moveNumberOf } from '../core/game.js';
import { createBoardView, type BoardView } from './boardView.js';
import { createIcon, type IconName } from './icons.js';
import { createCredits } from './credits.js';
import { createEngineSession } from './engineSession.js';
import { renderMoveList } from './moveList.js';
import { renderTutorPanel } from './tutorPanel.js';
import { renderHintPanel, type HintView } from './hintPanel.js';
import { locale, setLocale, t, type LocaleCode } from '../i18n/index.js';

type Promotion = 'q' | 'r' | 'b' | 'n';

/** Profondita' dell'analisi mostrata all'utente. Non e' la profondita' del bot: qui
 *  vogliamo la verita' sulla posizione, non una valutazione indebolita. */
const ANALYSIS_DEPTH = 14;

/**
 * Quante linee chiedere nell'analisi di controllo. Servono al tutor, non alla
 * valutazione: senza alternative non si puo' sapere se la mossa giusta era una sola
 * (e allora non e' colpa dell'utente) o se ce n'erano cinque. Il costo e' modesto.
 */
const ANALYSIS_MULTIPV = 3;

/**
 * Profondita' del GIUDIZIO, piu' alta di quella della valutazione mostrata.
 *
 * Misurato su una partita reale: la stessa posizione valutata a profondita' 14 dava
 * -0.98 in un caso e -1.26 nell'altro (dipende da cosa il motore ha gia' in tabella),
 * e quei 28 centipawn spostavano lo scarto da 15 a 9 punti — cioe' da "errore" a
 * "silenzio". Una soglia attraversata dal rumore e' una soglia inutile.
 *
 * Per lo stesso motivo il "prima" e il "dopo" vengono analizzati ENTRAMBI a questa
 * profondita': confrontare due valutazioni prodotte con regimi diversi introduce una
 * differenza che non c'entra nulla con la mossa giocata.
 */
const REVIEW_DEPTH = 17;

/**
 * Profondita' e larghezza della ricerca che risponde a "e adesso?".
 *
 * MultiPV alto perche' la domanda e' proprio "quante sono", e con tre linee non si
 * puo' rispondere; profondita' piu' bassa dell'analisi normale perche' qui non serve
 * la verita' sulla posizione ma sapere quali mosse non la rovinano, e a questa
 * profondita' l'ordine di grandezza e' gia' giusto. Una ricerca larga costa: e' un
 * altro motivo per farla solo su richiesta esplicita e mai in continuazione.
 */
const HINT_DEPTH = 12;
const HINT_MULTIPV = 20;

/** Pausa prima di riprovare dopo un guasto del motore. */
const RETRY_DELAY_MS = 1500;

/** Chiave della partita salvata. Cambiarla invalida i salvataggi vecchi. */
const SAVE_KEY = 'basic-chess:game/1';

/** Cosa si conserva di una partita fra un accesso e l'altro. */
interface SavedGame {
  startFen: string;
  /** Le mosse in UCI: bastano a ricostruire tutto il resto rigiocandole. */
  moves: string[];
  humanColor: Color;
  mistakes: MistakeEntry[];
  /** Quante volte si e' chiesto "e adesso?": fa parte del bilancio della partita. */
  hints?: number;
}

export function mountApp(root: HTMLElement): void {
  const saved = loadGame();
  let state: GameState = saved?.state ?? newGame();
  let humanColor: Color = saved?.humanColor ?? 'w';
  let orientation: 'white' | 'black' = humanColor === 'b' ? 'black' : 'white';
  let level: BotLevel = levelById(localStorage.getItem('basic-chess:level') ?? 'medio');

  /** Analisi della posizione attualmente mostrata (null = non ancora disponibile). */
  let evaluation: { line: EngineLine; depth: number; sideToMove: Color } | null = null;
  /** L'analisi completa dell'ultima posizione valutata: e' il "prima" per il tutor. */
  let lastAnalysis: Analysis | null = null;
  /** Mossa dell'utente in attesa di giudizio (con l'analisi della posizione di partenza). */
  let pendingReview: { before: Analysis | null; fenBefore: string; fenAfter: string } | null = null;
  /** Verdetto da mostrare; finche' c'e', il bot NON risponde e si aspetta l'utente. */
  let review: {
    verdict: MistakeVerdict;
    consequence: Consequence | null;
    /** Perche' la posizione peggiora: solo per l'errore strategico. */
    positional: readonly Explanation[];
    /** La confutazione INTERA prevista dal motore, non troncata al diagramma. */
    refutation: readonly string[];
    betterSans: readonly string[] | null;
    /** Posizione da cui parte la confutazione: serve a ricostruire il diagramma. */
    fenAfterMistake: string;
  } | null = null;
  /**
   * Riproduzione della confutazione sulla scacchiera principale. Non apriamo una
   * seconda scacchiera: la stessa, in sola lettura, con le frecce e uno slider.
   * Rivedere la sequenza mossa per mossa insegna piu' della singola immagine finale.
   */
  let preview: { consequence: Consequence; index: number; fenAfterMistake: string } | null = null;
  /**
   * La confutazione che il bot deve eseguire davvero.
   *
   * Se il tutor annuncia una punizione e poi il bot gioca altro, la lezione si
   * annulla — anzi, insegna il contrario: che la mossa sbagliata e' passata liscia.
   * Quando l'utente sceglie di TENERE la mossa segnalata, il bot smette per un
   * momento di essere un avversario della sua forza e diventa quello che punisce.
   *
   * Vale finche' l'utente sta al gioco: ad ogni turno si controlla se la posizione e'
   * ancora una di quelle previste dalla variante, e appena se ne esce il bot torna a
   * giocare col suo livello. Nota che questo rende il bot piu' forte del suo Elo
   * proprio dopo un errore: e' deliberato, ed e' il prezzo della coerenza didattica.
   */
  let forcedLine: { startFen: string; moves: readonly string[] } | null = null;
  let tutorEnabled = localStorage.getItem('basic-chess:tutor') !== 'off';
  /**
   * Se mostrare la valutazione del motore sotto la scacchiera.
   *
   * E' un'opzione e non una costante perche' il numero e' due cose insieme: una
   * misura per chi sa leggerla e una stampella per chi non ancora. Chi vuole
   * allenarsi a giudicare la posizione da solo deve poterlo spegnere.
   */
  let showEval = localStorage.getItem('basic-chess:eval') !== 'off';
  /**
   * Se mostrare anche la profondita' della ricerca accanto al punteggio.
   *
   * Spenta di default: "profondita' 14" e' un dettaglio del motore, non
   * un'informazione sulla partita, e chi non sa cos'e' la legge come rumore accanto
   * al numero che invece conta. Chi sa cos'e' la accende.
   */
  let showDepth = localStorage.getItem('basic-chess:depth') === 'on';
  /**
   * Vero quando l'utente ha appena rigiocato una mossa che aveva ritirato.
   *
   * In quel caso il bot deve RIPETERE la risposta di allora, non sceglierne una
   * nuova: altrimenti ritirare e rigiocare la stessa mossa porterebbe a una partita
   * diversa, e il "ritira" smetterebbe di essere una prova a costo zero per diventare
   * una scommessa. E' la condizione che rende non distruttivo il pulsante.
   */
  let replaying = false;
  /**
   * Il cursore a cui e' avvenuto l'ultimo ritiro. Serve a non chiedere conferma per
   * cancellare un seguito che l'utente ha appena messo da parte apposta.
   */
  let takenBackAt: number | null = null;
  /** Apertura riconosciuta per la posizione mostrata (null = nessuna, o non ancora). */
  let opening: Opening | null = null;
  /**
   * Vero finche' si e' dentro la teoria. Quando diventa falso il nome sparisce dalla
   * riga sotto la scacchiera.
   *
   * Prima il nome restava li' per tutta la partita, che e' anche quello che fa
   * Lichess, ma dice una cosa falsa: alla mossa 30 di una partita che ha lasciato i
   * libri da venti mosse, "Difesa Siciliana" non descrive piu' niente di quello che
   * si ha davanti. Il nome resta nel PGN, dove e' un dato sulla partita e non
   * un'etichetta sulla posizione.
   */
  let inTheory = false;
  /**
   * L'apertura della PARTITA INTERA, non della posizione mostrata: e' quella che
   * finisce nei tag del PGN, dove descrive la partita e non il punto in cui si sta
   * guardando.
   */
  let gameOpening: Opening | null = null;
  /** Nome con cui l'utente compare nel PGN. Vuoto = si usa "Human". */
  let playerName = localStorage.getItem('basic-chess:player') ?? '';
  let botThinking = false;
  /**
   * Contatore di versione dello stato. Ogni analisi lo cattura prima di partire e lo
   * ricontrolla al ritorno: se nel frattempo l'utente ha mosso o navigato, il
   * risultato riguarda una posizione che non e' piu' quella mostrata e va buttato.
   * Senza questo, un'analisi lenta sovrascrive quella di una posizione successiva.
   */
  let generation = 0;
  /** Timer del tentativo successivo quando il motore ha avuto un guasto. */
  let retryTimer: number | null = null;
  /** Gli errori segnalati in questa partita, per il riepilogo. */
  const mistakeLog: MistakeEntry[] = saved?.mistakes ?? [];
  /**
   * Il suggerimento aperto, se c'e'. `revealed` distingue il primo livello (quante
   * sono) dal secondo (quali sono): fra i due clic c'e' l'unico momento in cui si puo'
   * ancora provare a rispondere da soli.
   */
  let hint: HintView | null = null;
  /**
   * Quante volte si e' chiesto aiuto in questa partita.
   *
   * Non serve a punire: "ho chiesto aiuto nove volte" e' un'informazione su di se'
   * esattamente come "ho fatto tre errori gravi", e senza contarla il suggerimento
   * diventa una stampella invisibile.
   */
  let hintsUsed = saved?.hints ?? 0;

  root.replaceChildren();
  const {
    boardWrap,
    statusEl,
    movesEl,
    controlsEl,
    evalEl,
    tutorEl,
    previewEl,
    openingEl,
    recapEl,
    recapPanel,
    hintEl,
  } = buildLayout(root);
  const board: BoardView = createBoardView(boardWrap, handleUserMove);
  const engine = createEngineSession(() => renderEnginePanel());

  function refresh(): void {
    generation++;
    saveGame();
    if (preview) renderPreview();
    // L'ultimo argomento: dopo un ritiro si puo' muovere anche se il seguito e'
    // ancora li'. Senza, la scacchiera restava bloccata proprio dopo il comando che
    // serve a riprovare.
    else board.render(state, orientation, humanColor, takenBackAt === state.cursor);
    renderMoveList(movesEl, state, (cursor) => {
      state = goTo(state, cursor);
      evaluation = null;
      refresh();
    });
    renderStatus();
    renderControls();
    renderHint();
    renderEnginePanel();
    renderOpening();
    renderRecap();
    void updateOpening();
    renderPreviewControls();
    renderTutorPanel(
      tutorEl,
      review ? { ...review, previewing: preview !== null } : null,
      {
      onTakeBack: () => {
        // Si toglie una sola semi-mossa: il bot non ha ancora risposto, perche' il
        // tutor lo tiene fermo finche' l'utente non decide.
        const last = mistakeLog[mistakeLog.length - 1];
        if (last) last.corrected = true;
        renderRecap();
        review = null;
        preview = null;
        forcedLine = null;
        // Come il ritiro dalla barra: la mossa si mette indietro, non si cancella.
        state = goTo(state, Math.max(0, state.cursor - 1));
        takenBackAt = state.cursor;
        replaying = false;
        evaluation = null;
        refresh();
      },
      onContinue: () => {
        // Tenere la mossa vuol dire accettarne le conseguenze: da qui il bot gioca la
        // confutazione annunciata, non una mossa qualunque del suo livello.
        if (review && review.refutation.length > 0) {
          forcedLine = { startFen: review.fenAfterMistake, moves: review.refutation };
        }
        review = null;
        preview = null;
        refresh();
      },
      onReveal: () => {
        if (!review) return;
        const moves = review.verdict.betterMoves.length
          ? review.verdict.betterMoves
          : review.verdict.bestMove
            ? [review.verdict.bestMove]
            : [];
        review = { ...review, betterSans: moves.map(sanOfBestMove).filter((san) => san !== null) };
        refresh();
      },
      onShowConsequence: () => {
        if (!review?.consequence) return;
        // Si parte dalla FINE: la domanda dell'utente e' "cosa succede", e la
        // risposta e' la posizione che manifesta il danno. Lo slider serve poi a
        // tornare indietro e capire COME ci si arriva.
        preview = {
          consequence: review.consequence,
          index: review.consequence.manifestAt,
          fenAfterMistake: review.fenAfterMistake,
        };
        refresh();
      },
      onClosePreview: () => {
        preview = null;
        refresh();
      },
      },
    );
    void driveEngine();
  }

  // --- riepilogo ---------------------------------------------------------

  /**
   * Il riepilogo esiste solo se c'e' qualcosa da riepilogare.
   *
   * Un pannello che a inizio partita dice "nessun errore segnalato finora" occupa
   * spazio per non dire niente, e insegna a ignorare quella zona dello schermo —
   * proprio dove poi comparira' l'informazione che conta.
   */
  function renderRecap(): void {
    recapEl.replaceChildren();
    recapPanel.hidden = mistakeLog.length === 0 && hintsUsed === 0;
    if (recapPanel.hidden) return;
    const list = document.createElement('ul');
    for (const entry of mistakeLog) {
      const item = document.createElement('li');
      item.className = entry.corrected ? 'recap-corrected' : '';
      item.textContent = recapLine(entry);
      list.append(item);
    }
    if (mistakeLog.length > 0) recapEl.append(list);
    if (hintsUsed > 0) recapEl.append(text(t('recapHints', { count: hintsUsed }), 'recap-hints'));
  }

  function renderHint(): void {
    renderHintPanel(hintEl, hint, {
      onReveal: () => {
        if (!hint) return;
        hint = { ...hint, revealed: true };
        renderHint();
      },
      onClose: () => {
        hint = null;
        renderHint();
      },
    });
  }

  /**
   * Risponde a "e adesso cosa faccio?".
   *
   * Prima il libro, poi il motore. In apertura la domanda giusta non e' "quali mosse
   * non perdono" (il motore approva anche 3.a3) ma "dove si va da qui", e la risposta
   * ce l'abbiamo gia': si generano le mosse legali e si guarda quali portano a una
   * posizione che ha un nome. Costa una trentina di ricerche in una mappa, e le mosse
   * escono con il loro nome, che e' il modo in cui le aperture si imparano davvero.
   */
  async function askHint(): Promise<void> {
    if (hint) return;
    const mine = generation;
    const fen = currentFen(state);
    hintsUsed++;
    saveGame();

    const chess = positionAt(state);
    const candidates = chess.moves({ verbose: true }).map((move) => {
      const after = new Chess(fen);
      after.move(move.san);
      return { san: move.san, fenAfter: after.fen() };
    });
    const book = await findContinuations(candidates).catch(() => []);
    if (mine !== generation) return;

    // "Non c'e' piu' teoria" si dice solo se ci si era dentro: a chi e' partito da un
    // finale importato non interessa sapere che non e' un'apertura.
    const leavingBook = book.length === 0 && opening !== null && opening.plies === state.cursor;
    hint = { loading: true, book: [], leavingBook, hint: null, orientation: [], revealed: false };
    renderHint();

    const analysis = await engine.analyse(fen, { depth: HINT_DEPTH, multiPV: HINT_MULTIPV });
    if (mine !== generation || !hint) return;
    const built = analysis ? buildHint(analysis) : null;

    /*
     * Il libro passa comunque dal giudizio del motore.
     *
     * Avere un nome non vuol dire essere giocabile: da 1.e4 e5 2.Cf3 Cc6 la tabella
     * conosce anche 3.Cxe5 (Irish Gambit), che regala un cavallo per un pedone.
     * Elencarla a un principiante sotto l'etichetta "la teoria continua con" sarebbe
     * il danno peggiore che questo programma possa fare, perche' arriverebbe con
     * l'autorevolezza del nome proprio. Restano quindi solo le continuazioni note che
     * sono ANCHE ragionevoli; il nome serve a ricordarle, non a giustificarle.
     */
    const playable = new Set(built?.moves ?? []);
    const knownAndPlayable = built ? book.filter((entry) => playable.has(entry.san)) : book;

    hint = {
      loading: false,
      book: knownAndPlayable,
      leavingBook,
      hint: knownAndPlayable.length > 0 ? null : built,
      // L'orientamento serve dove l'elenco non risponde: se le mosse buone sono molte,
      // la domanda vera non e' "quale mossa" ma "che piano".
      orientation:
        knownAndPlayable.length === 0 && built?.shape === 'many'
          ? orientPosition(fen, chess.turn())
          : [],
      revealed: false,
    };
    renderHint();
  }

  // --- apertura ----------------------------------------------------------

  /**
   * Riconosce l'apertura fino alla posizione MOSTRATA, non fino alla fine della
   * partita: scorrendo indietro le mosse si vede il nome cambiare, ed e' cosi' che si
   * capisce dove una variante prende il suo nome.
   */
  async function updateOpening(): Promise<void> {
    const mine = generation;
    // Le POSIZIONI attraversate, non le mosse: l'indice e' per posizione, cosi' una
    // trasposizione viene riconosciuta lo stesso.
    const fens = [
      state.startFen,
      ...state.plies.slice(0, state.cursor).map((ply) => ply.fenAfter),
    ];
    try {
      const found = await findOpening(fens);
      const theory = await stillInTheory(found);
      const whole =
        state.cursor === state.plies.length
          ? found
          : await findOpening([state.startFen, ...state.plies.map((ply) => ply.fenAfter)]);
      if (mine !== generation) return;
      gameOpening = whole;
      if (found?.name !== opening?.name || found?.plies !== opening?.plies || theory !== inTheory) {
        opening = found;
        inTheory = theory;
        renderOpening();
      }
    } catch {
      // Il file delle aperture non e' essenziale: se manca, si gioca lo stesso.
      opening = null;
      inTheory = false;
    }
  }

  /**
   * Si e' ancora dentro la teoria?
   *
   * Non basta chiedere se la posizione corrente ha un nome: la tabella indicizza solo
   * le posizioni che un nome ce l'hanno, e in mezzo a una variante ci sono passaggi
   * che non lo hanno pur essendo teoria a tutti gli effetti. Quindi si guarda anche
   * un passo avanti: se una mossa legale porta a una posizione conosciuta, si e'
   * ancora su un sentiero battuto. E' lo stesso calcolo che risponde a "e adesso?",
   * e costa una trentina di ricerche in una mappa.
   */
  async function stillInTheory(found: Opening | null): Promise<boolean> {
    if (!found) return false;
    if (found.plies === state.cursor) return true;
    const fen = currentFen(state);
    const candidates = positionAt(state)
      .moves({ verbose: true })
      .map((move) => {
        const after = new Chess(fen);
        after.move(move.san);
        return { san: move.san, fenAfter: after.fen() };
      });
    return (await findContinuations(candidates)).length > 0;
  }

  function renderOpening(): void {
    openingEl.replaceChildren();
    // Fuori dalla teoria il nome sparisce: continuare a esibirlo sarebbe una didascalia
    // che parla di una posizione che non c'e' piu'.
    openingEl.hidden = !opening || !inTheory;
    if (!opening || !inTheory) return;
    const eco = document.createElement('span');
    eco.className = 'opening-eco';
    eco.textContent = opening.eco;
    const name = document.createElement('span');
    name.textContent = opening.name;
    openingEl.append(eco, name);
  }

  // --- diagramma della conseguenza ---------------------------------------

  /** Posizione raggiunta dopo `index` semi-mosse della confutazione. */
  function previewPosition(index: number): { fen: string; lastMove?: [string, string] } {
    if (!preview) return { fen: currentFen(state) };
    const chess = new Chess(preview.fenAfterMistake);
    let lastMove: [string, string] | undefined;
    for (const uci of preview.consequence.line.slice(0, index)) {
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
      });
      lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
    }
    return lastMove ? { fen: chess.fen(), lastMove } : { fen: chess.fen() };
  }

  function renderPreview(): void {
    if (!preview) return;
    const { fen, lastMove } = previewPosition(preview.index);
    // Le frecce mostrate sono quelle delle semi-mosse GIA' avvenute: scorrendo lo
    // slider il percorso si costruisce sotto gli occhi invece di comparire tutto
    // insieme alla fine.
    const arrows =
      preview.index === preview.consequence.manifestAt
        ? preview.consequence.arrows
        : transportArrows(preview.fenAfterMistake, preview.consequence.line.slice(0, preview.index));
    board.renderPosition(fen, orientation, arrows, lastMove as [never, never] | undefined);
  }

  function renderPreviewControls(): void {
    previewEl.replaceChildren();
    if (!preview) {
      previewEl.hidden = true;
      return;
    }
    previewEl.hidden = false;
    const total = preview.consequence.manifestAt;

    const caption = document.createElement('span');
    caption.className = 'preview-caption';
    caption.textContent =
      preview.index === 0
        ? t('previewStart')
        : t('previewCaption', { index: preview.index, total });
    const moves = document.createElement('span');
    moves.className = 'preview-moves';
    moves.textContent = preview.consequence.san
      .slice(0, preview.index)
      .map(toFigurine)
      .join(' ');

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(total);
    slider.value = String(preview.index);
    slider.addEventListener('input', () => {
      if (!preview) return;
      preview = { ...preview, index: Number(slider.value) };
      refresh();
    });

    previewEl.append(caption, slider, moves);
  }

  // --- motore ------------------------------------------------------------

  /**
   * Decide cosa deve fare il motore per lo stato corrente: far muovere il bot se e'
   * il suo turno, altrimenti valutare la posizione mostrata.
   */
  async function driveEngine(): Promise<void> {
    // Finche' un verdetto e' sullo schermo il bot resta fermo: l'utente deve poter
    // ritirare la mossa senza che la partita gli scappi avanti.
    if (review) return;
    if (pendingReview) {
      await runReview();
      return;
    }
    const atEnd = state.cursor === state.plies.length;
    const chess = positionAt(state);
    if (chess.isGameOver()) return;

    // Rigiocata una mossa ritirata, la risposta del bot e' gia' li' nel seguito: si
    // avanza il cursore invece di far pensare il motore. Vale una volta sola, ed e'
    // per questo che serve la bandiera: navigare a mano in una posizione dove tocca
    // al bot non deve far ripartire la partita da sola.
    if (replaying && chess.turn() !== humanColor && hasFuture(state)) {
      replaying = false;
      state = goTo(state, state.cursor + 1);
      evaluation = null;
      refresh();
      return;
    }
    const botTurn = atEnd && chess.turn() !== humanColor;
    if (botTurn) {
      if (botThinking) return;
      await playBotMove();
      return;
    }
    await updateEvaluation();
  }

  /**
   * Giudica la mossa appena giocata dall'utente.
   *
   * L'analisi del "prima" non viene ricalcolata: e' quella che il pannello di
   * valutazione aveva gia' prodotto mentre l'utente pensava. Ricalcolarla
   * raddoppierebbe l'attesa per un risultato identico.
   */
  async function runReview(): Promise<void> {
    const pending = pendingReview;
    pendingReview = null;
    if (!pending) return;
    const mine = generation;
    // Il "prima" gia' calcolato si riusa solo se c'e' ed e' abbastanza profondo;
    // altrimenti si rifa'. Costa un'analisi in piu', ma il bot sta comunque fermo.
    const before =
      pending.before && pending.before.depth >= REVIEW_DEPTH
        ? pending.before
        : await engine.analyse(pending.fenBefore, {
            depth: REVIEW_DEPTH,
            multiPV: ANALYSIS_MULTIPV,
          });
    // Se l'analisi fallisce si rinuncia al giudizio ma NON alla partita: si torna a
    // disegnare, cosi' il bot riprende a muovere.
    if (!before) {
      refresh();
      return;
    }
    if (mine !== generation) return;
    const after = await engine.analyse(pending.fenAfter, {
      depth: REVIEW_DEPTH,
      multiPV: ANALYSIS_MULTIPV,
    });
    if (!after) {
      refresh();
      return;
    }
    if (mine !== generation) return;
    const verdict = detectMistake(before, after);
    if (isImportant(verdict)) {
      // La confutazione e' il seguito previsto dopo la mossa giocata: e' la risposta
      // alla domanda "perche' e' un errore".
      const consequence = classifyConsequence(pending.fenAfter, after.lines[0]?.pv ?? []);
      review = {
        verdict,
        consequence,
        refutation: after.lines[0]?.pv ?? [],
        // Le ragioni posizionali si calcolano confrontando la posizione PRIMA
        // dell'errore con quella futura in cui la conseguenza si manifesta: e'
        // il confronto che mostra cosa ha causato la mossa.
        positional:
          consequence?.category === 'strategico'
            ? explainPositional(
                pending.fenBefore,
                futureFen(pending.fenAfter, consequence.line),
                // Chi ha sbagliato e' l'utente: il tutor giudica solo le sue mosse.
                humanColor,
              )
            : [],
        betterSans: null,
        fenAfterMistake: pending.fenAfter,
      };
      // Il riepilogo si costruisce durante la partita: a fine partita le posizioni
      // intermedie non ci sono piu' e ricostruirlo costerebbe una rianalisi completa.
      mistakeLog.push({
        ply: state.plies.length - 1,
        number: moveNumberOf(state, state.plies.length - 1),
        color: humanColor,
        san: state.plies[state.plies.length - 1]?.san ?? '?',
        severity: verdict.severity,
        category: consequence?.category ?? null,
        drop: verdict.drop,
        corrected: false,
      });
      renderRecap();
    }
    refresh();
  }

  /**
   * La mossa che il bot deve giocare per eseguire la confutazione annunciata, se la
   * partita e' ancora sui binari di quella variante. null appena se ne esce.
   */
  function forcedMove(): string | null {
    if (!forcedLine) return null;
    const here = short(currentFen(state));
    const chess = new Chess(forcedLine.startFen);
    for (let i = 0; i < forcedLine.moves.length; i++) {
      if (short(chess.fen()) === here) return forcedLine.moves[i]!;
      try {
        const uci = forcedLine.moves[i]!;
        chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
        });
      } catch {
        break;
      }
    }
    // Variante esaurita o partita uscita dai binari: il bot torna al suo livello.
    forcedLine = null;
    return null;
  }

  /**
   * Salva la partita ad ogni ridisegno.
   *
   * Perdere una partita di mezz'ora per un tasto F5 e' il genere di dispetto che fa
   * chiudere un programma e non riaprirlo. Si salvano le mosse in UCI e non lo stato
   * intero: rigiocarle ricostruisce tutto, e un salvataggio di una partita lunga resta
   * di pochi kilobyte.
   */
  function saveGame(): void {
    try {
      const payload: SavedGame = {
        startFen: state.startFen,
        moves: state.plies.map((ply) => `${ply.from}${ply.to}${ply.promotion ?? ''}`),
        humanColor,
        mistakes: mistakeLog,
        hints: hintsUsed,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // Spazio esaurito o memoria disabilitata: si gioca lo stesso, senza salvare.
    }
  }

  /** FEN senza i contatori: due percorsi diversi alla stessa posizione devono coincidere. */
  function short(fen: string): string {
    return fen.split(' ').slice(0, 4).join(' ');
  }

  /** La posizione raggiunta rigiocando `line` a partire da `fen`. */
  function futureFen(fen: string, line: readonly string[]): string {
    const chess = new Chess(fen);
    for (const uci of line) {
      try {
        chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
        });
      } catch {
        break;
      }
    }
    return chess.fen();
  }

  /** Traduce la mossa migliore da UCI a SAN, nella posizione in cui andava giocata. */
  function sanOfBestMove(uci: string): string | null {
    const chess = positionAt(goTo(state, Math.max(0, state.plies.length - 1)));
    try {
      return chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
      }).san;
    } catch {
      return null;
    }
  }

  async function playBotMove(): Promise<void> {
    const mine = generation;
    botThinking = true;
    renderStatus();
    const fen = currentFen(state);
    const forced = forcedMove();
    const chosen = forced ?? (await chooseBotMove((options) => engine.analyse(fen, options), level));
    botThinking = false;
    // La posizione e' cambiata mentre il bot pensava (l'utente ha ritirato una mossa o
    // ha navigato indietro): la mossa calcolata non c'entra piu' nulla.
    if (mine !== generation) {
      renderStatus();
      return;
    }
    if (!chosen) {
      renderStatus();
      scheduleRetry();
      return;
    }
    const uci = chosen;
    const next = uci
      ? playMove(
          state,
          uci.slice(0, 2) as Square,
          uci.slice(2, 4) as Square,
          (uci.slice(4) || undefined) as Promotion | undefined,
        )
      : null;
    // Se il bot non e' riuscito a muovere (motore ripartito, analisi vuota, mossa
    // rifiutata) si riprova invece di restare fermi: prima si aspettava in silenzio
    // per sempre, ed e' il guasto che l'utente ha incontrato in partita.
    if (!next) {
      scheduleRetry();
      return;
    }
    state = next;
    evaluation = null;
    refresh();
  }

  /**
   * Ritenta fra poco. La pausa serve a non trasformare un guasto persistente in un
   * ciclo stretto che consuma la macchina.
   */
  function scheduleRetry(): void {
    if (retryTimer !== null) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      refresh();
    }, RETRY_DELAY_MS);
  }

  async function updateEvaluation(): Promise<void> {
    const mine = generation;
    const fen = currentFen(state);
    // Se la posizione mostrata e' gia' quella analizzata, non si rianalizza.
    //
    // Non e' solo risparmio: a profondita' fissa due ricerche della STESSA posizione
    // non danno lo stesso numero, perche' la seconda parte con la tabella di
    // trasposizione piena e pota rami diversi. Il risultato era che ogni ridisegno
    // (accendere il tutor, girare la scacchiera) faceva ballare la valutazione di
    // qualche centesimo senza che nulla fosse cambiato sulla scacchiera.
    if (evaluation && lastAnalysis?.fen === fen && lastAnalysis.depth >= ANALYSIS_DEPTH) return;
    const analysis = await engine.analyse(fen, {
      depth: ANALYSIS_DEPTH,
      multiPV: ANALYSIS_MULTIPV,
    });
    if (mine !== generation || !analysis || analysis.lines.length === 0) return;
    lastAnalysis = analysis;
    evaluation = {
      line: analysis.lines[0]!,
      depth: analysis.depth,
      sideToMove: fen.split(' ')[1] === 'b' ? 'b' : 'w',
    };
    renderEnginePanel();
  }

  // --- mosse -------------------------------------------------------------
  function handleUserMove(from: string, to: string): void {
    const origin = from as Square;
    const target = to as Square;

    // Rigiocare esattamente la mossa che si era ritirata non e' una mossa nuova: e'
    // un "rifai". Il seguito resta dov'e' e il bot ripetera' la sua risposta.
    const ahead = state.plies[state.cursor];
    if (ahead && ahead.from === origin && ahead.to === target && !ahead.promotion) {
      state = goTo(state, state.cursor + 1);
      replaying = true;
      evaluation = null;
      review = null;
      preview = null;
      refresh();
      return;
    }

    // Giocare mentre si guarda una posizione passata cancella il seguito: si chiede
    // conferma qui, non dentro core/game (che resta puro).
    //
    // Non si chiede pero' per il seguito appena messo da parte da un ritiro: e' roba
    // che l'utente ha tolto lui un secondo fa, e chiedergli se e' sicuro di volerla
    // buttare sarebbe una domanda a cui ha gia' risposto.
    if (hasFuture(state) && takenBackAt !== state.cursor) {
      const discarded = state.plies.length - state.cursor;
      if (!confirm(t('overwriteFuture', { count: discarded }))) {
        refresh(); // rimette il pezzo dove stava
        return;
      }
    }
    if (hasFuture(state)) state = truncateHere(state);

    if (needsPromotion(state, origin, target)) {
      askPromotion(boardWrap, (piece) => {
        if (piece) commit(origin, target, piece);
        else refresh();
      });
      return;
    }
    commit(origin, target);
  }

  function commit(from: Square, to: Square, promotion?: Promotion): void {
    hint = null;
    replaying = false;
    takenBackAt = null;
    const fenBefore = currentFen(state);
    const mover = positionAt(state).turn();
    const next = playMove(state, from, to, promotion);
    if (!next) {
      refresh(); // mossa illegale: annulla il movimento visivo
      return;
    }
    /*
     * Il tutor giudica tutte le mosse dell'UTENTE, punto.
     *
     * Prima chiedeva anche di avere gia' in mano l'analisi della posizione di
     * partenza, e se mancava rinunciava in silenzio. Sembrava un'ottimizzazione
     * innocua e invece era un buco grosso: l'analisi arriva in un paio di secondi,
     * quindi il tutor taceva ogni volta che si muoveva in fretta — cioe' proprio
     * quando si sbaglia. Su una partita reale sono passate senza una parola una mossa
     * che perdeva 25 punti di aspettativa e una che ne perdeva 39.
     *
     * Adesso l'analisi del "prima", se manca, la calcola runReview. Costa una ricerca
     * in piu' mentre il bot sarebbe comunque fermo ad aspettare la decisione.
     */
    const judgeable = tutorEnabled && mover === humanColor;
    const before = lastAnalysis?.fen === fenBefore ? lastAnalysis : null;
    state = next;
    pendingReview = judgeable ? { before, fenBefore, fenAfter: currentFen(state) } : null;
    evaluation = null;
    review = null;
    preview = null;
    refresh();
  }

  // --- pannelli ----------------------------------------------------------
  function renderStatus(): void {
    // Il verdetto finale si riferisce alla partita intera, non alla posizione che si
    // sta guardando: durante un rewind mostriamo di nuovo il tratto.
    const atEnd = state.cursor === state.plies.length;
    const over = atEnd ? gameOver(state) : null;
    if (over) {
      const winner = over.winner ? t(over.winner === 'w' ? 'white' : 'black') : '';
      statusEl.textContent = t(over.reason, { winner });
      statusEl.className = 'status over';
      return;
    }
    statusEl.className = 'status';
    if (botThinking) {
      statusEl.textContent = t('thinking');
      return;
    }
    statusEl.textContent = positionAt(state).turn() === 'w' ? t('turnWhite') : t('turnBlack');
  }

  function renderEnginePanel(): void {
    evalEl.replaceChildren();
    evalEl.hidden = !showEval;
    if (!showEval) return;
    const failure = engine.error();
    if (failure) {
      evalEl.append(text(t('engineFailed', { error: failure }), 'eval-note'));
      return;
    }
    if (engine.loading()) {
      evalEl.append(text(t('engineLoading'), 'eval-note'));
      return;
    }
    // A partita finita nessuna analisi partira' mai (non c'e' niente da analizzare):
    // senza questo ramo il pannello restava a "analisi…" per sempre dopo il matto.
    const over = state.cursor === state.plies.length ? gameOver(state) : null;
    if (over) {
      // Solo il risultato: il MOTIVO ("scacco matto", "stallo") lo dice gia' la riga
      // di stato qui accanto, e ripeterlo a mezzo centimetro di distanza e' rumore.
      evalEl.append(text(over.winner ? (over.winner === 'w' ? '1-0' : '0-1') : '½-½', 'eval-score'));
      return;
    }
    if (!evaluation) {
      evalEl.append(text(t('analysing'), 'eval-note'));
      return;
    }
    const score = formatScore(evaluation.line, evaluation.sideToMove);
    evalEl.append(text(score, 'eval-score'));
    if (showDepth) evalEl.append(text(t('evalDepth', { depth: evaluation.depth }), 'eval-note'));
  }

  /**
   * I comandi, divisi secondo un criterio solo: cosa succede se li clicchi per
   * sbaglio.
   *
   * Quelli innocui (navigare, ruotare la scacchiera, copiare qualcosa negli appunti,
   * accendere il tutor) diventano ICONE: si annullano da soli o non cambiano niente,
   * quindi non hanno bisogno di una parola che li spieghi prima del clic. Quelli che
   * fanno perdere lavoro (ritirare, ricominciare, importare) restano pulsanti con
   * l'etichetta scritta, perche' devono farsi leggere.
   *
   * Effetto collaterale utile: le icone non vanno tradotte, quindi ogni lingua nuova
   * costa meno, e la fila di pulsanti sotto la scacchiera smette di pesare piu' della
   * scacchiera stessa.
   */
  function renderControls(): void {
    controlsEl.replaceChildren();

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    // Quattro gruppi: navigare, guardare, scambiare posizioni con l'esterno, gestire
    // la sessione. Sono gruppi VERI e non solo separatori disegnati, perche' quando la
    // barra va a capo (su telefono ci sta in due righe) deve spezzarsi fra un gruppo e
    // l'altro: "esporta" in fondo a una riga e "importa" in cima a quella dopo
    // dividerebbe proprio la coppia che si e' costruita per stare insieme.
    toolbar.append(
      group(
        iconButton('first', t('first'), state.cursor === 0, () => seek(0)),
        iconButton('previous', t('previous'), state.cursor === 0, () => seek(state.cursor - 1)),
        iconButton('next', t('next'), state.cursor >= state.plies.length, () =>
          seek(state.cursor + 1),
        ),
        iconButton('last', t('last'), state.cursor >= state.plies.length, () =>
          seek(state.plies.length),
        ),
      ),
      separator(),
      group(
        iconButton('flip', t('flipBoard'), false, () => {
          orientation = orientation === 'white' ? 'black' : 'white';
          refresh();
        }),
        iconButton(
          tutorEnabled ? 'tutor' : 'tutorOff',
          tutorEnabled ? t('tutorOn') : t('tutorOff'),
          false,
          () => {
            tutorEnabled = !tutorEnabled;
            localStorage.setItem('basic-chess:tutor', tutorEnabled ? 'on' : 'off');
            if (!tutorEnabled) review = null;
            refresh();
          },
          tutorEnabled,
        ),
        // Il suggerimento sta accanto al tutor perche' e' la stessa voce, ma e' un
        // pulsante e non un interruttore: parla solo se glielo si chiede, ed e'
        // deliberato. Un tutor che si offre da solo quando le mosse buone sono molte
        // parlerebbe quasi sempre, e allora il suo silenzio direbbe "qui ce n'e' una
        // sola, cerca il colpo": si imparerebbe a leggere il tutor invece della
        // posizione.
        iconButton(
          'hint',
          t('hint'),
          hint !== null || review !== null || state.cursor !== state.plies.length || gameOver(state) !== null,
          () => void askHint(),
        ),
      ),
      separator(),
      // Esporta e importa stanno vicini e sono due icone sole: sono la stessa cosa in
      // due versi. Esportare puo' voler dire due cose (la partita o la posizione), e
      // il menu e' il posto giusto per una scelta che si fa raramente - meglio di due
      // pulsanti permanenti nella barra.
      group(
        // Il menu resta aperto anche a partita vuota: la POSIZIONE si esporta sempre
        // (dopo aver importato un finale di mosse non ce n'e' nessuna, ed e' proprio
        // il FEN che si vuole rimandare indietro). A spegnersi e' solo la voce della
        // partita, quando di partita non ce n'e'.
        menuButton('export', t('exportTitle'), false, [
          {
            label: t('exportPgn'),
            run: () => void copy(toPgn(state, pgnTags(), annotations())),
            disabled: state.plies.length === 0,
          },
          { label: t('exportFen'), run: () => void copy(currentFen(state)) },
        ]),
        iconButton('import', t('importTitle'), false, importPosition),
      ),
      separator(),
      group(
        // Ricominciare fa perdere la partita, quindi in teoria vorrebbe un'etichetta -
        // ma con una conferma esplicita il clic per sbaglio non fa piu' danno, e
        // l'icona torna legittima.
        iconButton('newGame', t('newGame'), false, () => {
          if (state.plies.length > 0 && !confirm(t('newGameConfirm'))) return;
          state = newGame();
          evaluation = null;
          clearTutor();
          refresh();
        }),
        iconButton('settings', t('settings'), false, openSettings),
      ),
      // Il ritiro sta in fondo, staccato dal resto dalla spinta a destra: e' l'unico
      // comando che cambia la partita invece di guardarla, e la distanza lo dice
      // meglio di un separatore. Era un pulsante con l'etichetta perche' sembrava
      // distruttivo; da quando la mossa ritirata si puo' rimettere identica, non lo e'
      // piu', e si e' preso la sua icona come tutti gli altri.
      group(iconButton('undo', t('takeBack'), state.cursor === 0, takeBack), 'push'),
    );

    // Nella riga restano le due impostazioni che si cambiano DA UNA PARTITA
    // ALL'ALTRA. Nome, lingua e visibilita' della valutazione si scelgono una volta
    // e poi ingombrerebbero per sempre: sono finite nella finestra delle impostazioni.
    const settings = document.createElement('div');
    settings.className = 'settings';
    settings.append(levelSelect(), colorChoice());

    controlsEl.append(toolbar, settings);
  }

  /**
   * Un comando innocuo: solo l'icona, con la parola nel suggerimento e
   * nell'etichetta accessibile (che serve a chi usa un lettore di schermo e a chi
   * naviga da tastiera).
   */
  function iconButton(
    name: IconName,
    label: string,
    disabled: boolean,
    onClick: () => void,
    active = false,
  ): HTMLElement {
    const element = document.createElement('button');
    element.type = 'button';
    // La classe e non il discendente ".toolbar button": dentro la barra ci sono anche
    // le voci del menu di "esporta", che sono pulsanti di testo e non quadrati di 34
    // pixel. Selezionare per posizione le rendeva larghe quanto un'icona.
    element.className = 'icon-btn';
    element.title = label;
    element.setAttribute('aria-label', label);
    if (active) {
      element.classList.add('on');
      element.setAttribute('aria-pressed', 'true');
    }
    element.disabled = disabled;
    element.append(createIcon(name));
    element.addEventListener('click', onClick);
    return element;
  }

  /**
   * Un'icona che apre un menu di due o tre voci. Il menu si chiude al primo clic
   * fuori: e' l'unico comportamento che nessuno deve imparare.
   */
  function menuButton(
    name: IconName,
    label: string,
    disabled: boolean,
    items: readonly { label: string; run: () => void; disabled?: boolean }[],
  ): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'menu-wrap';
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.hidden = true;
    for (const item of items) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.textContent = item.label;
      entry.disabled = item.disabled ?? false;
      entry.addEventListener('click', () => {
        menu.hidden = true;
        item.run();
      });
      menu.append(entry);
    }
    const trigger = iconButton(name, label, disabled, () => {
      menu.hidden = !menu.hidden;
      if (menu.hidden) return;
      const close = (event: MouseEvent): void => {
        if (wrap.contains(event.target as Node)) return;
        menu.hidden = true;
        document.removeEventListener('click', close);
      };
      // Nel prossimo giro di eventi: altrimenti il clic che apre il menu lo richiude.
      setTimeout(() => document.addEventListener('click', close));
    });
    wrap.append(trigger, menu);
    return wrap;
  }

  /** Un gruppo di icone che non si spezza quando la barra va a capo. */
  function group(...children: readonly (HTMLElement | 'push')[]): HTMLElement {
    const element = document.createElement('span');
    const push = children.includes('push');
    element.className = push ? 'group push' : 'group';
    element.append(...children.filter((child): child is HTMLElement => child !== 'push'));
    return element;
  }

  function separator(): HTMLElement {
    const element = document.createElement('span');
    element.className = 'sep';
    return element;
  }

  /**
   * Ritira la mossa. Se il bot ha gia' risposto ne toglie DUE: ritirarne una sola
   * lascerebbe il turno all'avversario, che rigiocherebbe subito — l'utente si
   * ritroverebbe al punto di prima senza capire perche'.
   *
   * Le mosse ritirate NON vengono cancellate, solo messe indietro: la freccia
   * "avanti" le rimette dov'erano, e rigiocando a mano la stessa mossa il bot ripete
   * la sua risposta di allora. Cosi' ritirare non e' un atto distruttivo ma una prova
   * reversibile — che e' esattamente quello che deve essere in un programma dove si
   * impara sbagliando.
   */
  function takeBack(): void {
    const chess = positionAt(state);
    const back = chess.turn() === humanColor ? 2 : 1;
    state = goTo(state, Math.max(0, state.cursor - back));
    takenBackAt = state.cursor;
    replaying = false;
    evaluation = null;
    clearTutor();
    refresh();
  }

  /**
   * Chi ha giocato la partita, per i tag White/Black del PGN. Senza questi un PGN
   * esportato non dice nulla su chi fosse l'avversario, ed e' proprio l'informazione
   * che serve a rileggerlo fra sei mesi. Per il bot si dichiara anche l'Elo misurato.
   */
  function pgnTags(): Record<string, string> {
    const human = playerName.trim() || 'Human';
    const bot = `Bot ${level.id}`;
    const players =
      humanColor === 'w'
        ? { White: human, Black: bot, BlackElo: String(level.nominalElo) }
        : { White: bot, Black: human, WhiteElo: String(level.nominalElo) };
    // ECO e Opening sono tag standard di fatto (li scrivono ChessBase, SCID, Lichess):
    // e' li' che il nome dell'apertura va a vivere quando sparisce dallo schermo, e da
    // li' lo rilegge qualunque altro programma.
    return gameOpening
      ? { ...players, ECO: gameOpening.eco, Opening: gameOpening.name }
      : players;
  }

  /**
   * Il riepilogo degli errori come commenti PGN, uno per semi-mossa segnalata.
   *
   * Cosi' il riepilogo viaggia insieme alla partita invece di essere un secondo
   * testo da copiare a parte: un PGN annotato si apre in qualunque programma di
   * scacchi, che mostra le note e le conserva, e rientrando qui le rileggiamo.
   *
   * Le mosse RITIRATE non esistono piu' nella partita, quindi la loro nota si
   * attacca alla mossa che le ha sostituite: "qui avevi giocato Cf6, poi ritirata".
   */
  function annotations(): Map<number, string> {
    const map = new Map<number, string>();
    // Dove finisce la teoria, segnato sulla mossa che ci ha portati: rileggendo il PGN
    // fra sei mesi e' esattamente il punto che si vuole ritrovare, perche' da li' in
    // poi le mosse sono farina del sacco di chi ha giocato.
    //
    // Il confine e' l'ultima posizione che il libro CONOSCE, e la frase dice
    // esattamente quello. Sullo schermo il nome sopravvive di una semi-mossa in piu'
    // (vedi stillInTheory), ma quella e' una gentilezza per non farlo lampeggiare nei
    // buchi dell'indice, non un'affermazione su dove finisca la teoria.
    if (gameOpening && gameOpening.plies > 0 && gameOpening.plies <= state.plies.length) {
      map.set(gameOpening.plies - 1, t('annotationTheory', { name: gameOpening.name }));
    }
    for (const entry of mistakeLog) {
      const state_ = entry.corrected
        ? t('annotationUndone', { move: toFigurine(entry.san) })
        : t('annotationKept');
      const human = t('annotationLine', {
        kind: entry.category ? t(RECAP_CATEGORY[entry.category] ?? 'headStrategico') : '—',
        severity: t(RECAP_SEVERITY[entry.severity] ?? 'tutorMistake'),
        what: `-${Math.round(entry.drop)}`,
        state: state_,
      });
      const machine = [
        entry.category ?? '',
        entry.severity,
        Math.round(entry.drop),
        entry.corrected ? 'undone' : 'kept',
        entry.san,
      ].join(',');
      const previous = map.get(entry.ply);
      const comment = `${human} [${ANNOTATION_TAG} ${machine}]`;
      map.set(entry.ply, previous ? `${previous} ${comment}` : comment);
    }
    return map;
  }

  /** Rilegge le nostre annotazioni da un PGN importato, per ricostruire il riepilogo. */
  function readAnnotations(comments: ReadonlyMap<number, string>): void {
    mistakeLog.length = 0;
    for (const [ply, comment] of [...comments].sort((a, b) => a[0] - b[0])) {
      const match = comment.match(new RegExp(`\\[${ANNOTATION_TAG} ([^\\]]+)\\]`));
      if (!match) continue;
      const [category, severity, drop, undone, san] = match[1]!.split(',');
      mistakeLog.push({
        ply,
        number: moveNumberOf(state, ply),
        color: state.plies[ply]?.color ?? 'w',
        san: san ?? '?',
        severity: severity ?? 'mistake',
        category: category || null,
        drop: Number(drop) || 0,
        corrected: undone === 'undone',
      });
    }
  }

  function nameInput(): HTMLElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.value = playerName;
    input.placeholder = t('playerName');
    input.title = t('playerName');
    input.addEventListener('change', () => {
      playerName = input.value;
      localStorage.setItem('basic-chess:player', playerName);
    });
    return input;
  }

  function levelSelect(): HTMLElement {
    const select = document.createElement('select');
    select.title = t('levelTitle');
    for (const option of BOT_LEVELS) {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = `${option.id} · ${option.nominalElo}`;
      element.selected = option.id === level.id;
      select.append(element);
    }
    select.addEventListener('change', () => {
      level = levelById(select.value);
      localStorage.setItem('basic-chess:level', level.id);
      refresh();
    });
    return select;
  }

  /**
   * Con che colore si gioca, come coppia di figurine invece che come menu a tendina.
   *
   * "Bianco"/"Nero" in un combo obbliga a leggere due parole per capire una cosa che
   * e' visiva; e non dice l'altra meta' dell'informazione, cioe' che l'avversario e'
   * il bot e prende l'altro colore. Le due coppie omino/robot la mostrano intera, e
   * non hanno bisogno di traduzione.
   */
  function colorChoice(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'side-choice';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', t('playAs'));
    for (const color of ['w', 'b'] as const) {
      const label = document.createElement('label');
      const title = t(color === 'w' ? 'playAsWhite' : 'playAsBlack');
      label.title = title;
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'side';
      input.value = color;
      input.checked = color === humanColor;
      input.setAttribute('aria-label', title);
      input.addEventListener('change', () => {
        if (!input.checked) return;
        humanColor = color;
        orientation = color === 'w' ? 'white' : 'black';
        refresh();
      });
      label.append(input, sideIcon('person', color === 'w'), sideIcon('bot', color === 'b'));
      group.append(label);
    }
    return group;
  }

  function sideIcon(name: IconName, light: boolean): HTMLElement {
    const span = document.createElement('span');
    span.className = light ? 'side-icon light' : 'side-icon dark';
    span.append(createIcon(name));
    return span;
  }

  function languageSelect(): HTMLElement {
    const select = document.createElement('select');
    select.title = t('language');
    for (const code of ['it', 'en'] as const) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code.toUpperCase();
      option.selected = locale() === code;
      select.append(option);
    }
    select.addEventListener('change', () => {
      setLocale(select.value as LocaleCode);
      refresh();
    });
    return select;
  }

  /**
   * Le impostazioni che si toccano una volta sola, in una finestra invece che in una
   * riga sempre presente.
   *
   * E' una `<dialog>` nativa e non un pannello nostro: la modalita', la chiusura con
   * Esc e la trappola del focus le fa il browser, e sono esattamente le tre cose che
   * si sbagliano riscrivendole a mano.
   */
  function openSettings(): void {
    const dialog = document.createElement('dialog');
    dialog.className = 'settings-dialog';

    const title = document.createElement('h2');
    title.textContent = t('settings');

    const evalRow = document.createElement('label');
    evalRow.className = 'check-row';
    const evalBox = document.createElement('input');
    evalBox.type = 'checkbox';
    evalBox.checked = showEval;
    evalBox.addEventListener('change', () => {
      showEval = evalBox.checked;
      localStorage.setItem('basic-chess:eval', showEval ? 'on' : 'off');
      depthBox.disabled = !showEval;
      renderEnginePanel();
    });
    evalRow.append(evalBox, document.createTextNode(t('showEval')));

    // La profondita' e' un dettaglio della valutazione: se la valutazione non si
    // vede, la sua opzione non ha nulla a cui riferirsi e resta spenta.
    const depthRow = document.createElement('label');
    depthRow.className = 'check-row nested';
    const depthBox = document.createElement('input');
    depthBox.type = 'checkbox';
    depthBox.checked = showDepth;
    depthBox.disabled = !showEval;
    depthBox.addEventListener('change', () => {
      showDepth = depthBox.checked;
      localStorage.setItem('basic-chess:depth', showDepth ? 'on' : 'off');
      renderEnginePanel();
    });
    depthRow.append(depthBox, document.createTextNode(t('showDepth')));

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'settings-close';
    close.textContent = t('settingsClose');
    close.addEventListener('click', () => dialog.close());

    dialog.append(
      title,
      field(t('playerName'), nameInput()),
      field(t('language'), languageSelect()),
      evalRow,
      depthRow,
      close,
    );
    // Il cambio di lingua deve ridisegnare tutto, e finche' la finestra e' aperta
    // ridisegnare sotto di lei sarebbe uno sfarfallio inutile: si aspetta la chiusura.
    dialog.addEventListener('close', () => {
      dialog.remove();
      refresh();
    });
    document.body.append(dialog);
    dialog.showModal();
  }

  function field(label: string, control: HTMLElement): HTMLElement {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const caption = document.createElement('span');
    caption.textContent = label;
    wrap.append(caption, control);
    return wrap;
  }

  /**
   * Importa indifferentemente un FEN (una posizione: e' la forma in cui circolano le
   * raccolte di finali) o un PGN (una partita). Il riconoscimento lo fa core/import.
   */
  function importPosition(): void {
    const text = prompt(t('importPrompt'));
    if (!text) return;
    try {
      const imported = parseGameInput(text);
      state = imported.state;
      evaluation = null;
      clearTutor();
      if (imported.comments) readAnnotations(imported.comments);
      // Si prende il tratto dalla posizione CORRENTE, non da quella di partenza: in un
      // FEN coincidono, ma in un PGN la posizione di partenza e' quasi sempre quella
      // iniziale, e il giocatore vuole proseguire la partita dal punto in cui e'.
      humanColor = positionAt(state).turn();
      orientation = humanColor === 'b' ? 'black' : 'white';
      refresh();
      toast(
        imported.kind === 'fen'
          ? t('importedFen')
          : t('importedPgn', { count: state.plies.length }),
      );
    } catch (error) {
      alert(t('importInvalid', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  /**
   * Azzera tutto cio' che il tutor sta mostrando. Va chiamato ogni volta che la
   * partita cambia identita' (nuova partita, import): un verdetto sopravvissuto a un
   * cambio di posizione parla di una mossa che non esiste piu', e per di piu' tiene
   * fermo il bot.
   */
  function clearTutor(): void {
    hint = null;
    review = null;
    preview = null;
    forcedLine = null;
    // Anche il riepilogo: appartiene alla partita, non alla sessione. Senza questo
    // gli errori di una partita comparivano nel riepilogo di quella successiva.
    mistakeLog.length = 0;
    hintsUsed = 0;
  }

  function seek(cursor: number): void {
    hint = null;
    state = goTo(state, cursor);
    evaluation = null;
    refresh();
  }

  // Frecce della tastiera per scorrere la partita: piu' comodo dei pulsanti quando
  // si ripercorre una partita per capire dove si e' sbagliato.
  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === 'ArrowLeft') seek(state.cursor - 1);
    else if (event.key === 'ArrowRight') seek(state.cursor + 1);
    else if (event.key === 'Home') seek(0);
    else if (event.key === 'End') seek(state.plies.length);
    else return;
    event.preventDefault();
  });

  refresh();
}

// --- helper di costruzione ------------------------------------------------

function buildLayout(root: HTMLElement) {
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = t('appTitle');
  // I crediti stanno nell'intestazione e chiusi: sono un obbligo di licenza, non
  // qualcosa che l'utente deve leggere per giocare.
  header.append(title, createCredits());

  const layout = document.createElement('div');
  layout.className = 'layout';

  const boardColumn = document.createElement('div');
  boardColumn.className = 'board-column';
  const boardWrap = document.createElement('div');
  boardWrap.className = 'board-wrap';
  const statusEl = document.createElement('div');
  statusEl.className = 'status';
  /**
   * La valutazione non e' piu' un pannello a destra ma un pezzo della riga di stato.
   *
   * Un pannello intero per due parole (un numero e una profondita') costava un titolo,
   * un bordo e una posizione fissa nella colonna; e su telefono finiva sotto la piega,
   * dove chi gioca non la vedeva mai. Qui sta accanto al tratto e all'apertura, cioe'
   * insieme alle altre due cose che descrivono la posizione che si ha davanti.
   */
  const evalEl = document.createElement('div');
  evalEl.className = 'evaluation';
  // Il nome dell'apertura sta sotto la scacchiera e non nella lista mosse: parla
  // della posizione che si ha davanti, non dell'elenco delle mosse fatte.
  const openingEl = document.createElement('div');
  openingEl.className = 'opening';
  openingEl.hidden = true;
  const controlsEl = document.createElement('div');
  controlsEl.className = 'controls';
  // Lo slider della conseguenza sta SOTTO la scacchiera, non nel pannello laterale:
  // si guarda il diagramma mentre lo si scorre, non si cerca il comando altrove.
  const previewEl = document.createElement('div');
  previewEl.className = 'preview-bar';
  previewEl.hidden = true;
  const infoRow = document.createElement('div');
  infoRow.className = 'board-info';
  infoRow.append(statusEl, evalEl, openingEl);
  boardColumn.append(boardWrap, previewEl, infoRow, controlsEl);

  const side = document.createElement('aside');

  // Il pannello del tutor sta in cima: quando compare e' la cosa piu' importante
  // sullo schermo, e non deve costringere a cercarla.
  const tutorEl = document.createElement('section');
  tutorEl.className = 'panel tutor';
  tutorEl.hidden = true;

  // Il suggerimento sta subito sotto il tutor e ha lo stesso aspetto: e' la stessa
  // voce che parla, con la differenza che questa risponde invece di intervenire.
  const hintEl = document.createElement('section');
  hintEl.className = 'panel tutor hint';
  hintEl.hidden = true;

  const recapPanel = document.createElement('section');
  recapPanel.className = 'panel';
  const recapTitle = document.createElement('h2');
  recapTitle.textContent = t('recap');
  const recapEl = document.createElement('div');
  recapEl.className = 'recap';
  recapPanel.append(recapTitle, recapEl);
  recapPanel.hidden = true;

  const movesPanel = document.createElement('section');
  movesPanel.className = 'panel';
  const movesTitle = document.createElement('h2');
  movesTitle.textContent = t('moves');
  const movesEl = document.createElement('div');
  movesEl.className = 'movelist';
  movesPanel.append(movesTitle, movesEl);

  side.append(tutorEl, hintEl, recapPanel, movesPanel);
  layout.append(boardColumn, side);
  root.append(header, layout);
  return {
    boardWrap,
    statusEl,
    movesEl,
    controlsEl,
    evalEl,
    tutorEl,
    previewEl,
    openingEl,
    recapEl,
    recapPanel,
    hintEl,
  };
}

function text(content: string, className: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = content;
  return element;
}

function needsPromotion(state: GameState, from: Square, to: Square): boolean {
  const piece = positionAt(state).get(from);
  if (!piece || piece.type !== 'p') return false;
  const rank = to[1];
  return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
}

const PROMOTION_GLYPHS: Record<Promotion, string> = {
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
};

function askPromotion(container: HTMLElement, done: (piece: Promotion | null) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'promotion';
  overlay.title = t('promotionTitle');
  const choices = document.createElement('div');
  choices.className = 'choices';
  for (const piece of ['q', 'r', 'b', 'n'] as const) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = PROMOTION_GLYPHS[piece];
    element.addEventListener('click', () => {
      overlay.remove();
      done(piece);
    });
    choices.append(element);
  }
  // Un click fuori dalle scelte annulla la mossa: meglio di intrappolare l'utente.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
      done(null);
    }
  });
  overlay.append(choices);
  container.append(overlay);
}

async function copy(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    toast(t('copied'));
  } catch {
    // Alcuni browser negano la clipboard senza gesto diretto o fuori da HTTPS:
    // meglio mostrare il testo che perdere il PGN.
    prompt(t('copied'), content);
  }
}

function toast(message: string): void {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 1800);
}

/** Una riga del riepilogo: un errore segnalato durante la partita. */
interface MistakeEntry {
  /** Indice della semi-mossa nella partita: serve ad attaccarci il commento PGN. */
  ply: number;
  number: number;
  color: 'w' | 'b';
  san: string;
  severity: string;
  category: string | null;
  drop: number;
  /** Vero se l'utente ha ritirato la mossa e ne ha giocata un'altra. */
  corrected: boolean;
}

const RECAP_SEVERITY: Record<string, string> = {
  blunder: 'tutorBlunder',
  mistake: 'tutorMistake',
  inaccuracy: 'tutorInaccuracy',
};
const RECAP_CATEGORY: Record<string, string> = {
  banale: 'headBanale',
  tattico: 'headTattico',
  strategico: 'headStrategico',
};

function recapLine(entry: MistakeEntry): string {
  const number = `${entry.number}${entry.color === 'w' ? '.' : '...'}`;
  return t('recapLine', {
    number,
    san: toFigurine(entry.san),
    kind: entry.category ? t(RECAP_CATEGORY[entry.category] ?? 'headStrategico') : '—',
    severity: t(RECAP_SEVERITY[entry.severity] ?? 'tutorMistake'),
    what: `-${Math.round(entry.drop)}`,
    state: t(entry.corrected ? 'recapCorrected' : 'recapKept'),
  });
}


/**
 * Ricarica la partita salvata, se c'e' ed e' ancora valida.
 *
 * Qualunque intoppo (dati corrotti, formato vecchio, una mossa che non si rigioca
 * piu') si risolve ricominciando da capo invece che con una schermata rotta: una
 * partita persa e' un fastidio, un programma che non parte e' un guasto.
 */
function loadGame(): {
  state: GameState;
  humanColor: Color;
  mistakes: MistakeEntry[];
  hints: number;
} | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedGame;
    let state = newGame(saved.startFen);
    for (const uci of saved.moves) {
      const next = playMove(
        state,
        uci.slice(0, 2) as Square,
        uci.slice(2, 4) as Square,
        (uci.slice(4) || undefined) as Promotion | undefined,
      );
      if (!next) return null;
      state = next;
    }
    return {
      state,
      humanColor: saved.humanColor === 'b' ? 'b' : 'w',
      mistakes: Array.isArray(saved.mistakes) ? saved.mistakes : [],
      hints: typeof saved.hints === 'number' ? saved.hints : 0,
    };
  } catch {
    return null;
  }
}
