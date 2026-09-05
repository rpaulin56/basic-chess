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
import { toPgn } from '../core/pgn.js';
import { BOT_LEVELS, levelById, selectBotMove, type BotLevel } from '../bot/bot.js';
import { formatScore } from '../engine/winProb.js';
import type { Analysis, EngineLine } from '../engine/types.js';
import { detectMistake, isImportant, type MistakeVerdict } from '../tutor/detect.js';
import { classifyConsequence, type Consequence } from '../tutor/classify.js';
import { explainPositional, type Explanation } from '../tutor/positional.js';
import { findOpening, type Opening } from '../openings/openings.js';
import { createBoardView, type BoardView } from './boardView.js';
import { createEngineSession } from './engineSession.js';
import { renderMoveList } from './moveList.js';
import { renderTutorPanel } from './tutorPanel.js';
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

export function mountApp(root: HTMLElement): void {
  let state: GameState = newGame();
  let orientation: 'white' | 'black' = 'white';
  let humanColor: Color = 'w';
  let level: BotLevel = levelById(localStorage.getItem('basic-chess:level') ?? 'medio');

  /** Analisi della posizione attualmente mostrata (null = non ancora disponibile). */
  let evaluation: { line: EngineLine; depth: number; sideToMove: Color } | null = null;
  /** L'analisi completa dell'ultima posizione valutata: e' il "prima" per il tutor. */
  let lastAnalysis: Analysis | null = null;
  /** Mossa dell'utente in attesa di giudizio (con l'analisi della posizione di partenza). */
  let pendingReview: { before: Analysis; fenBefore: string; fenAfter: string } | null = null;
  /** Verdetto da mostrare; finche' c'e', il bot NON risponde e si aspetta l'utente. */
  let review: {
    verdict: MistakeVerdict;
    consequence: Consequence | null;
    /** Perche' la posizione peggiora: solo per l'errore strategico. */
    positional: readonly Explanation[];
    bestSan: string | null;
    /** Posizione da cui parte la confutazione: serve a ricostruire il diagramma. */
    fenAfterMistake: string;
  } | null = null;
  /**
   * Riproduzione della confutazione sulla scacchiera principale. Non apriamo una
   * seconda scacchiera: la stessa, in sola lettura, con le frecce e uno slider.
   * Rivedere la sequenza mossa per mossa insegna piu' della singola immagine finale.
   */
  let preview: { consequence: Consequence; index: number; fenAfterMistake: string } | null = null;
  let tutorEnabled = localStorage.getItem('basic-chess:tutor') !== 'off';
  /** Apertura riconosciuta per la posizione mostrata (null = nessuna, o non ancora). */
  let opening: Opening | null = null;
  let botThinking = false;
  /**
   * Contatore di versione dello stato. Ogni analisi lo cattura prima di partire e lo
   * ricontrolla al ritorno: se nel frattempo l'utente ha mosso o navigato, il
   * risultato riguarda una posizione che non e' piu' quella mostrata e va buttato.
   * Senza questo, un'analisi lenta sovrascrive quella di una posizione successiva.
   */
  let generation = 0;

  root.replaceChildren();
  const { boardWrap, statusEl, movesEl, controlsEl, evalEl, tutorEl, previewEl, openingEl } =
    buildLayout(root);
  const board: BoardView = createBoardView(boardWrap, handleUserMove);
  const engine = createEngineSession(() => renderEnginePanel());

  function refresh(): void {
    generation++;
    if (preview) renderPreview();
    else board.render(state, orientation, humanColor);
    renderMoveList(movesEl, state, (cursor) => {
      state = goTo(state, cursor);
      evaluation = null;
      refresh();
    });
    renderStatus();
    renderControls();
    renderEnginePanel();
    renderOpening();
    void updateOpening();
    renderPreviewControls();
    renderTutorPanel(
      tutorEl,
      review ? { ...review, previewing: preview !== null } : null,
      {
      onTakeBack: () => {
        // Si toglie una sola semi-mossa: il bot non ha ancora risposto, perche' il
        // tutor lo tiene fermo finche' l'utente non decide.
        review = null;
        preview = null;
        state = truncateHere(goTo(state, Math.max(0, state.plies.length - 1)));
        evaluation = null;
        refresh();
      },
      onContinue: () => {
        review = null;
        preview = null;
        refresh();
      },
      onReveal: () => {
        if (!review?.verdict.bestMove) return;
        review = { ...review, bestSan: sanOfBestMove(review.verdict.bestMove) };
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

  // --- apertura ----------------------------------------------------------

  /**
   * Riconosce l'apertura fino alla posizione MOSTRATA, non fino alla fine della
   * partita: scorrendo indietro le mosse si vede il nome cambiare, ed e' cosi' che si
   * capisce dove una variante prende il suo nome.
   */
  async function updateOpening(): Promise<void> {
    const mine = generation;
    const san = state.plies.slice(0, state.cursor).map((ply) => ply.san);
    try {
      const found = await findOpening(san);
      if (mine !== generation) return;
      if (found?.name !== opening?.name || found?.plies !== opening?.plies) {
        opening = found;
        renderOpening();
      }
    } catch {
      // Il file delle aperture non e' essenziale: se manca, si gioca lo stesso.
      opening = null;
    }
  }

  function renderOpening(): void {
    openingEl.replaceChildren();
    openingEl.hidden = !opening;
    if (!opening) return;
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
    // Le frecce di trasporto hanno senso solo sulla posizione finale: a meta'
    // sequenza indicherebbero un futuro che sullo schermo non c'e' ancora.
    const arrows = preview.index === preview.consequence.manifestAt ? preview.consequence.arrows : [];
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
    if (engine.error()) return;
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
    // Il "prima" gia' calcolato si riusa solo se e' abbastanza profondo; altrimenti si
    // rifa'. Costa un'analisi in piu', ma il bot starebbe comunque pensando.
    const before =
      pending.before.depth >= REVIEW_DEPTH
        ? pending.before
        : await engine.analyse(pending.fenBefore, {
            depth: REVIEW_DEPTH,
            multiPV: ANALYSIS_MULTIPV,
          });
    if (mine !== generation || !before) return;
    const after = await engine.analyse(pending.fenAfter, {
      depth: REVIEW_DEPTH,
      multiPV: ANALYSIS_MULTIPV,
    });
    if (mine !== generation || !after) return;
    const verdict = detectMistake(before, after);
    if (isImportant(verdict)) {
      // La confutazione e' il seguito previsto dopo la mossa giocata: e' la risposta
      // alla domanda "perche' e' un errore".
      const consequence = classifyConsequence(pending.fenAfter, after.lines[0]?.pv ?? []);
      review = {
        verdict,
        consequence,
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
        bestSan: null,
        fenAfterMistake: pending.fenAfter,
      };
    }
    refresh();
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
    const analysis = await engine.analyse(fen, { depth: level.depth, multiPV: level.multiPV });
    botThinking = false;
    // La posizione e' cambiata mentre il bot pensava (l'utente ha ritirato una mossa o
    // ha navigato indietro): la mossa calcolata non c'entra piu' nulla.
    if (mine !== generation || !analysis) {
      renderStatus();
      return;
    }
    const uci = selectBotMove(analysis, level);
    if (!uci) return;
    const next = playMove(
      state,
      uci.slice(0, 2) as Square,
      uci.slice(2, 4) as Square,
      (uci.slice(4) || undefined) as Promotion | undefined,
    );
    if (!next) return;
    state = next;
    evaluation = null;
    refresh();
  }

  async function updateEvaluation(): Promise<void> {
    const mine = generation;
    const fen = currentFen(state);
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

    // Giocare mentre si guarda una posizione passata cancella il seguito: si chiede
    // conferma qui, non dentro core/game (che resta puro).
    if (hasFuture(state)) {
      const discarded = state.plies.length - state.cursor;
      if (!confirm(t('overwriteFuture', { count: discarded }))) {
        refresh(); // rimette il pezzo dove stava
        return;
      }
      state = truncateHere(state);
    }

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
    const fenBefore = currentFen(state);
    const mover = positionAt(state).turn();
    const next = playMove(state, from, to, promotion);
    if (!next) {
      refresh(); // mossa illegale: annulla il movimento visivo
      return;
    }
    // Il tutor giudica solo le mosse dell'UTENTE, e solo se ha in mano l'analisi
    // giusta della posizione di partenza (puo' mancare se si e' mosso in fretta).
    const judgeable = tutorEnabled && mover === humanColor && lastAnalysis?.fen === fenBefore;
    const before = lastAnalysis;
    state = next;
    pendingReview = judgeable && before ? { before, fenBefore, fenAfter: currentFen(state) } : null;
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
      evalEl.append(
        text(over.winner ? (over.winner === 'w' ? '1-0' : '0-1') : '½-½', 'eval-score'),
        text(t(over.reason, { winner: over.winner ? t(over.winner === 'w' ? 'white' : 'black') : '' }), 'eval-note'),
      );
      return;
    }
    if (!evaluation) {
      evalEl.append(text(t('analysing'), 'eval-note'));
      return;
    }
    const score = formatScore(evaluation.line, evaluation.sideToMove);
    evalEl.append(text(score, 'eval-score'), text(t('evalDepth', { depth: evaluation.depth }), 'eval-note'));
  }

  function renderControls(): void {
    controlsEl.replaceChildren();

    const nav = document.createElement('div');
    nav.className = 'nav';
    nav.append(
      button('⏮', t('first'), state.cursor === 0, () => seek(0)),
      button('◀', t('previous'), state.cursor === 0, () => seek(state.cursor - 1)),
      button('▶', t('next'), state.cursor >= state.plies.length, () => seek(state.cursor + 1)),
      button('⏭', t('last'), state.cursor >= state.plies.length, () => seek(state.plies.length)),
    );
    controlsEl.append(nav);

    controlsEl.append(
      button(t('takeBack'), t('takeBack'), state.cursor === 0, takeBack),
      button(t('flipBoard'), t('flipBoard'), false, () => {
        orientation = orientation === 'white' ? 'black' : 'white';
        refresh();
      }),
      button(t('newGame'), t('newGame'), false, () => {
        state = newGame();
        evaluation = null;
        clearTutor();
        refresh();
      }),
      button(t('importPosition'), t('importTitle'), false, importPosition),
      button(t('exportPgn'), t('exportPgn'), state.plies.length === 0, () => {
        void copy(toPgn(state));
      }),
      button(t('copyFen'), t('copyFen'), false, () => {
        void copy(currentFen(state));
      }),
      button(tutorEnabled ? t('tutorOn') : t('tutorOff'), t('tutorOn'), false, () => {
        tutorEnabled = !tutorEnabled;
        localStorage.setItem('basic-chess:tutor', tutorEnabled ? 'on' : 'off');
        if (!tutorEnabled) review = null;
        refresh();
      }),
      levelSelect(),
      colorSelect(),
      languageSelect(),
    );
  }

  /**
   * Ritira la mossa. Se il bot ha gia' risposto ne toglie DUE: ritirarne una sola
   * lascerebbe il turno all'avversario, che rigiocherebbe subito — l'utente si
   * ritroverebbe al punto di prima senza capire perche'.
   */
  function takeBack(): void {
    const chess = positionAt(goTo(state, state.plies.length));
    const back = chess.turn() === humanColor ? 2 : 1;
    state = truncateHere(goTo(state, Math.max(0, state.plies.length - back)));
    evaluation = null;
    clearTutor();
    refresh();
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

  function colorSelect(): HTMLElement {
    const select = document.createElement('select');
    select.title = t('playAs');
    for (const color of ['w', 'b'] as const) {
      const element = document.createElement('option');
      element.value = color;
      element.textContent = t(color === 'w' ? 'white' : 'black');
      element.selected = color === humanColor;
      select.append(element);
    }
    select.addEventListener('change', () => {
      humanColor = select.value === 'b' ? 'b' : 'w';
      orientation = humanColor === 'w' ? 'white' : 'black';
      refresh();
    });
    return select;
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
    review = null;
    preview = null;
  }

  function seek(cursor: number): void {
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
  header.append(title);

  const layout = document.createElement('div');
  layout.className = 'layout';

  const boardColumn = document.createElement('div');
  boardColumn.className = 'board-column';
  const boardWrap = document.createElement('div');
  boardWrap.className = 'board-wrap';
  const statusEl = document.createElement('div');
  statusEl.className = 'status';
  const controlsEl = document.createElement('div');
  controlsEl.className = 'controls';
  // Lo slider della conseguenza sta SOTTO la scacchiera, non nel pannello laterale:
  // si guarda il diagramma mentre lo si scorre, non si cerca il comando altrove.
  const previewEl = document.createElement('div');
  previewEl.className = 'preview-bar';
  previewEl.hidden = true;
  boardColumn.append(boardWrap, previewEl, statusEl, controlsEl);

  const side = document.createElement('aside');

  // Il pannello del tutor sta in cima: quando compare e' la cosa piu' importante
  // sullo schermo, e non deve costringere a cercarla.
  const tutorEl = document.createElement('section');
  tutorEl.className = 'panel tutor';
  tutorEl.hidden = true;

  const evalPanel = document.createElement('section');
  evalPanel.className = 'panel';
  const evalTitle = document.createElement('h2');
  evalTitle.textContent = t('evaluation');
  const evalEl = document.createElement('div');
  evalEl.className = 'evaluation';
  evalPanel.append(evalTitle, evalEl);

  const movesPanel = document.createElement('section');
  movesPanel.className = 'panel';
  const movesTitle = document.createElement('h2');
  movesTitle.textContent = t('moves');
  // Il nome dell'apertura sta in cima alla lista mosse, dove si guarda comunque.
  const openingEl = document.createElement('div');
  openingEl.className = 'opening';
  openingEl.hidden = true;
  const movesEl = document.createElement('div');
  movesEl.className = 'movelist';
  movesPanel.append(movesTitle, openingEl, movesEl);

  side.append(tutorEl, evalPanel, movesPanel);
  layout.append(boardColumn, side);
  root.append(header, layout);
  return { boardWrap, statusEl, movesEl, controlsEl, evalEl, tutorEl, previewEl, openingEl };
}

function text(content: string, className: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = content;
  return element;
}

function button(label: string, title: string, disabled: boolean, onClick: () => void): HTMLElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.title = title;
  element.disabled = disabled;
  element.addEventListener('click', onClick);
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
