import { Chess } from 'chess.js';
import { Chessground } from 'chessground';
import type { Key, Role } from 'chessground/types';
import { t } from '../i18n/index.js';
import { createIcon } from './icons.js';

/**
 * L'editor di posizioni: si mettono i pezzi, si dice a chi tocca, e si gioca da li'.
 *
 * Chiesto da una giocatrice esperta (settembre 2026). Su Lichess da una posizione
 * impostata si gioca contro Stockfish, che non spiega niente; qui la Nonna gioca come una
 * persona, ferma quando sbagli e racconta la partita. Per allenare un finale o una
 * struttura precisa e' un vantaggio vero.
 *
 * Le scelte, discusse prima di scrivere:
 * - due file di pezzi, bianchi e neri, invece di un interruttore per il colore: un tocco
 *   in meno, e nessuna "modalita'" da ricordare;
 * - tocca e metti invece di trascinare, che sul telefono e' scomodo; i pezzi gia' sulla
 *   scacchiera si possono comunque trascinare, e trascinati fuori spariscono;
 * - l'arrocco compare solo quando Re e Torre sono sulle loro case, e si spunta da solo;
 * - niente presa en passant: serve una volta su mille, e chi ne ha bisogno incolla il FEN;
 * - la posizione si valida mentre la si costruisce, e il motivo si dice a parole.
 */
export interface EditorHandlers {
  /** Si gioca dalla posizione costruita, col colore scelto. */
  readonly onPlay: (fen: string, color: 'w' | 'b') => void;
}

type Brush = { readonly role: Role; readonly color: 'white' | 'black' } | 'erase' | null;

const ROLES: readonly Role[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const EMPTY = '8/8/8/8/8/8/8/8';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

/** Le quattro possibilita' d'arrocco: lettera del FEN, casa del Re e casa della Torre. */
const CASTLES = [
  { flag: 'K', king: 'e1', rook: 'h1', color: 'white', label: 'editorCastleShort' },
  { flag: 'Q', king: 'e1', rook: 'a1', color: 'white', label: 'editorCastleLong' },
  { flag: 'k', king: 'e8', rook: 'h8', color: 'black', label: 'editorCastleShort' },
  { flag: 'q', king: 'e8', rook: 'a8', color: 'black', label: 'editorCastleLong' },
] as const;

export function openEditor(startFen: string, orientation: 'white' | 'black', handlers: EditorHandlers): void {
  const [placement = START, side = 'w'] = startFen.split(' ');
  let turn: 'w' | 'b' = side === 'b' ? 'b' : 'w';
  let brush: Brush = null;
  /** Come e' girata la scacchiera dell'editor: si puo' girare anche da qui dentro. */
  let view = orientation;
  /** La casa della presa en passant scelta; vale solo finche' la presa e' possibile. */
  let enPassant: string | null = startFen.split(' ')[3]?.match(/^[a-h][36]$/) ? startFen.split(' ')[3]! : null;
  /** Le caselle d'arrocco tolte a mano: le altre restano spuntate quando sono possibili. */
  const refused = new Set<string>();

  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog editor-dialog';
  const title = document.createElement('h2');
  title.textContent = t('editorTitle');

  const boardEl = document.createElement('div');
  boardEl.className = 'editor-board';
  const api = Chessground(boardEl, {
    fen: placement,
    orientation,
    coordinates: true,
    movable: { free: true, color: 'both', showDests: false },
    draggable: { deleteOnDropOff: true },
    premovable: { enabled: false },
    highlight: { lastMove: true, check: false },
    animation: { enabled: false },
    events: { change: () => update() },
  });

  // Il pennello: un tocco su una casa mette il pezzo scelto, o lo toglie se c'e' gia'.
  boardEl.addEventListener('pointerdown', (event) => {
    if (!brush) return;
    const key = api.getKeyAtDomPos([event.clientX, event.clientY]);
    if (!key) return;
    event.preventDefault();
    event.stopPropagation();
    const current = api.state.pieces.get(key);
    const pieces = new Map(api.state.pieces);
    if (brush === 'erase' || (current && current.role === brush.role && current.color === brush.color)) {
      pieces.delete(key);
    } else {
      pieces.set(key, { role: brush.role, color: brush.color });
    }
    api.setPieces(new Map([[key, pieces.get(key)]]));
    update();
  }, true);

  // La tavolozza: i pezzi di ciascun colore dal LORO lato della scacchiera, come su Lichess.
  // Partendo da una scacchiera vuota e girata, era poco intuitivo capire dove andasse cosa
  // (segnalato provando); cosi' la scacchiera si legge da sola, e girandola le file si
  // scambiano con lei.
  const paletteTop = document.createElement('div');
  paletteTop.className = 'editor-palette cg-wrap';
  const paletteBottom = document.createElement('div');
  paletteBottom.className = 'editor-palette cg-wrap';
  const tools: HTMLButtonElement[] = [];
  const tool = (content: Element | string, value: Brush, label: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-tool';
    button.title = label;
    button.setAttribute('aria-label', label);
    if (typeof content === 'string') button.textContent = content;
    else button.append(content);
    button.addEventListener('click', () => {
      const same =
        value !== null &&
        brush !== null &&
        (value === 'erase' ? brush === 'erase' : brush !== 'erase' && brush.role === value.role && brush.color === value.color);
      brush = same ? null : value;
      for (const other of tools) other.classList.toggle('selected', other === button && !same);
      // Col pennello in mano i pezzi non si trascinano: un tocco e' un pezzo messo.
      api.set({ movable: { free: brush === null }, draggable: { enabled: brush === null } });
    });
    tools.push(button);
    return button;
  };
  const rows: Record<'white' | 'black', HTMLButtonElement[]> = { white: [], black: [] };
  for (const color of ['white', 'black'] as const) {
    for (const role of ROLES) {
      const piece = document.createElement('piece');
      piece.className = `${role} ${color}`;
      rows[color].push(tool(piece, { role, color }, t(`editorPiece_${color}_${role}`)));
    }
  }
  // Elimina pezzi: un cestino piccolo, in fondo alla fila di sotto, sempre nello stesso
  // posto. Prima era un pulsantone con la scritta, poi una casa vuota alta due righe.
  const eraser = tool(createIcon('trash'), 'erase', t('editorErase'));
  eraser.classList.add('editor-eraser');
  const spacer = document.createElement('span');
  spacer.className = 'editor-spacer';
  /** Le due file dal lato giusto: sopra il colore che sta in alto sulla scacchiera. */
  const layout = (): void => {
    const top = view === 'white' ? 'black' : 'white';
    const bottom = top === 'white' ? 'black' : 'white';
    paletteTop.replaceChildren(...rows[top], spacer);
    paletteBottom.replaceChildren(...rows[bottom], eraser);
  };
  layout();

  const button = (label: string, onClick: () => void, className = ''): HTMLButtonElement => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (className) element.className = className;
    element.addEventListener('click', onClick);
    return element;
  };

  const setups = document.createElement('div');
  setups.className = 'editor-setups';
  // Girare la scacchiera anche da qui: con la stessa icona della barra.
  const flip = document.createElement('button');
  flip.type = 'button';
  flip.className = 'editor-flip';
  flip.title = t('flipBoard');
  flip.setAttribute('aria-label', t('flipBoard'));
  flip.append(createIcon('flip'));
  flip.addEventListener('click', () => {
    view = view === 'white' ? 'black' : 'white';
    api.set({ orientation: view });
    layout();
  });
  setups.append(
    flip,
    button(t('editorEmpty'), () => {
      api.set({ fen: EMPTY });
      update();
    }),
    button(t('editorStart'), () => {
      api.set({ fen: START });
      turn = 'w';
      for (const radio of turnRadios) radio.checked = radio.value === 'w';
      refused.clear();
      update();
    }),
  );

  // Due colonne, una per colore: in cima a chi tocca, sotto che cosa puo' fare ("Il Bianco
  // puo': arroccare corto, arroccare lungo, prendere en passant in c6"). Le frasi lunghe una
  // sotto l'altra ripetevano "Il Bianco puo'" a ogni riga (proposto da chi gioca).
  const turnLine = document.createElement('fieldset');
  turnLine.className = 'editor-sides';
  const turnName = document.createElement('legend');
  turnName.className = 'choice-name';
  turnName.textContent = t('editorTurn');
  turnLine.append(turnName);
  const turnRadios: HTMLInputElement[] = [];
  /** Le liste di "che cosa puo' fare", una per colonna. */
  const rights: Record<'w' | 'b', HTMLElement> = {
    w: document.createElement('div'),
    b: document.createElement('div'),
  };
  for (const [value, key] of [
    ['w', 'editorTurnWhite'],
    ['b', 'editorTurnBlack'],
  ] as const) {
    const label = document.createElement('label');
    label.className = 'editor-turn-choice';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'editor-turn';
    radio.value = value;
    radio.checked = value === turn;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      turn = value;
      update();
    });
    turnRadios.push(radio);
    const swatch = document.createElement('span');
    swatch.className = `editor-swatch ${value === 'w' ? 'white' : 'black'}`;
    const name = document.createElement('span');
    name.textContent = t(key);
    label.append(radio, swatch, name);
    const column = document.createElement('div');
    column.className = 'editor-side';
    rights[value].className = 'editor-rights';
    column.append(label, rights[value]);
    turnLine.append(column);
  }

  const problem = document.createElement('p');
  problem.className = 'editor-problem';

  const playWhite = button(t('editorPlayWhite'), () => play('w'), 'primary');
  const playBlack = button(t('editorPlayBlack'), () => play('b'), 'primary');
  // Chiudere non salva niente: e' un annullare, e si chiama cosi'.
  const cancel = button(t('editorCancel'), () => dialog.close());
  const playRow = document.createElement('div');
  playRow.className = 'tutor-actions';
  playRow.append(playWhite, playBlack, cancel);

  /** I diritti d'arrocco possibili adesso, cioe' con Re e Torre sulle loro case. */
  function possibleCastles(): (typeof CASTLES)[number][] {
    return CASTLES.filter((castle) => {
      const king = api.state.pieces.get(castle.king as Key);
      const rook = api.state.pieces.get(castle.rook as Key);
      return king?.role === 'king' && king.color === castle.color && rook?.role === 'rook' && rook.color === castle.color;
    });
  }

  /**
   * Le case in cui chi ha il tratto potrebbe prendere en passant: un pedone avversario
   * sulla quarta traversa della sua avanzata, con le due case dietro libere (da li' e'
   * appena passato con la doppia spinta) e un pedone di chi muove accanto. Come
   * l'arrocco, la scelta compare solo quando e' possibile: di solito una casa, a volte
   * due. L'editor di Lichess propone sempre tutte e otto le case della traversa.
   */
  function possibleEnPassant(): string[] {
    const us = turn === 'w' ? 'white' : 'black';
    const them = turn === 'w' ? 'black' : 'white';
    const [landing, target, origin] = turn === 'w' ? ['5', '6', '7'] : ['4', '3', '2'];
    const files = 'abcdefgh';
    const at = (file: string, rank: string) => api.state.pieces.get(`${file}${rank}` as Key);
    const squares: string[] = [];
    for (let i = 0; i < 8; i++) {
      const file = files[i]!;
      const pawn = at(file, landing);
      if (pawn?.role !== 'pawn' || pawn.color !== them) continue;
      if (at(file, target) || at(file, origin)) continue;
      const beside = [files[i - 1], files[i + 1]].some((next) => {
        if (!next) return false;
        const piece = at(next, landing);
        return piece?.role === 'pawn' && piece.color === us;
      });
      if (beside) squares.push(`${file}${target}`);
    }
    return squares;
  }

  function fen(): string {
    const flags = possibleCastles()
      .filter((castle) => !refused.has(castle.flag))
      .map((castle) => castle.flag)
      .join('');
    const ep = enPassant && possibleEnPassant().includes(enPassant) ? enPassant : '-';
    return `${api.getFen()} ${turn} ${flags || '-'} ${ep} 0 1`;
  }

  /** Il primo problema della posizione, detto a parole; null se si puo' giocare. */
  function validate(): string | null {
    const pieces = [...api.state.pieces.entries()];
    const kings = (color: 'white' | 'black') =>
      pieces.filter(([, piece]) => piece.role === 'king' && piece.color === color).length;
    if (kings('white') === 0) return t('editorNoWhiteKing');
    if (kings('black') === 0) return t('editorNoBlackKing');
    if (kings('white') > 1 || kings('black') > 1) return t('editorTwoKings');
    if (pieces.some(([key, piece]) => piece.role === 'pawn' && (key[1] === '1' || key[1] === '8'))) {
      return t('editorPawnEdge');
    }
    let chess: Chess;
    try {
      chess = new Chess(fen());
    } catch {
      return t('editorInvalid');
    }
    // Chi NON ha il tratto non puo' essere sotto scacco: vorrebbe dire che l'altro potrebbe
    // prendergli il Re.
    try {
      const other = fen().replace(` ${turn} `, ` ${turn === 'w' ? 'b' : 'w'} `);
      if (new Chess(other, { skipValidation: true }).inCheck()) {
        return t(turn === 'w' ? 'editorBlackInCheck' : 'editorWhiteInCheck');
      }
    } catch {
      // Posizione che non si legge nemmeno cosi': ci pensa il controllo sopra.
    }
    if (chess.isCheckmate()) return t('editorMate');
    if (chess.isStalemate()) return t('editorStalemate');
    return null;
  }

  /** La doppia spinta che rende possibile la presa en passant su `square`: da dove e dove. */
  function doublePush(square: string): [Key, Key] {
    const file = square[0]!;
    // c6 (tratto al Bianco): il Nero e' andato da c7 a c5. c3: il Bianco da c2 a c4.
    return square[1] === '6' ? [`${file}7` as Key, `${file}5` as Key] : [`${file}2` as Key, `${file}4` as Key];
  }

  function update(): void {
    const castles: Record<'w' | 'b', HTMLElement[]> = { w: [], b: [] };
    const lastMoves: HTMLElement[] = [];
    for (const castle of possibleCastles()) {
      const line = document.createElement('label');
      line.className = 'choice-check';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !refused.has(castle.flag);
      box.addEventListener('change', () => {
        if (box.checked) refused.delete(castle.flag);
        else refused.add(castle.flag);
        update();
      });
      const text = document.createElement('span');
      text.textContent = t(castle.label);
      line.append(box, text);
      castles[castle.color === 'white' ? 'w' : 'b'].push(line);
    }
    // L'en passant detto per quello che e': l'ULTIMA MOSSA di chi non ha il tratto, una doppia
    // spinta. La presa ne e' solo la conseguenza, e un pedone alla volta e' quello appena
    // mosso: le scelte sono esclusive, e sulla scacchiera la mossa si vede evidenziata come
    // in partita (proposto da chi gioca).
    const possible = possibleEnPassant();
    if (enPassant && !possible.includes(enPassant)) enPassant = null;
    api.set({ lastMove: enPassant ? doublePush(enPassant) : [] });
    for (const square of possible) {
      const line = document.createElement('label');
      line.className = 'choice-check';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = enPassant === square;
      box.addEventListener('change', () => {
        enPassant = box.checked ? square : null;
        update();
      });
      const text = document.createElement('span');
      const [from, to] = doublePush(square);
      text.textContent = `${from}–${to}`;
      line.append(box, text);
      lastMoves.push(line);
    }
    // Ogni colonna: gli arrocchi del suo colore e, per chi non ha il tratto, l'ultima mossa.
    // I titoli compaiono solo se sotto c'e' qualcosa da scegliere.
    const heading = (key: string): HTMLElement => {
      const element = document.createElement('span');
      element.className = 'editor-rights-title';
      element.textContent = t(key);
      return element;
    };
    const mover = turn === 'w' ? 'b' : 'w';
    for (const side of ['w', 'b'] as const) {
      const parts: HTMLElement[] = [];
      if (castles[side].length > 0) parts.push(heading('editorCastling'), ...castles[side]);
      if (side === mover && lastMoves.length > 0) parts.push(heading('editorLastMove'), ...lastMoves);
      rights[side].replaceChildren(...parts);
    }
    const issue = validate();
    problem.textContent = issue ?? '';
    problem.hidden = issue === null;
    playWhite.disabled = issue !== null;
    playBlack.disabled = issue !== null;
  }

  function play(color: 'w' | 'b'): void {
    if (validate() !== null) return;
    const position = fen();
    dialog.close();
    handlers.onPlay(position, color);
  }

  dialog.append(title, paletteTop, boardEl, paletteBottom, setups, turnLine, problem, playRow);
  dialog.addEventListener('close', () => {
    api.destroy();
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
  // Misurata a finestra aperta: chiusa, la scacchiera non ha dimensioni.
  api.redrawAll();
  update();
}
