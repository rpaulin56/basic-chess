import { Chess } from 'chess.js';
import { Chessground } from 'chessground';
import type { Key, Role } from 'chessground/types';
import { t } from '../i18n/index.js';

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
  { flag: 'K', king: 'e1', rook: 'h1', color: 'white', label: 'castleWhiteShort' },
  { flag: 'Q', king: 'e1', rook: 'a1', color: 'white', label: 'castleWhiteLong' },
  { flag: 'k', king: 'e8', rook: 'h8', color: 'black', label: 'castleBlackShort' },
  { flag: 'q', king: 'e8', rook: 'a8', color: 'black', label: 'castleBlackLong' },
] as const;

export function openEditor(startFen: string, orientation: 'white' | 'black', handlers: EditorHandlers): void {
  const [placement = START, side = 'w'] = startFen.split(' ');
  let turn: 'w' | 'b' = side === 'b' ? 'b' : 'w';
  let brush: Brush = null;
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
    highlight: { lastMove: false, check: false },
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

  // La tavolozza: due file da sei, piu' la gomma e la mano per spostare.
  const palette = document.createElement('div');
  palette.className = 'editor-palette cg-wrap';
  const tools: HTMLButtonElement[] = [];
  const tool = (content: HTMLElement | string, value: Brush, label: string): HTMLButtonElement => {
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
  for (const color of ['white', 'black'] as const) {
    const row = document.createElement('div');
    row.className = 'editor-row';
    for (const role of ROLES) {
      const piece = document.createElement('piece');
      piece.className = `${role} ${color}`;
      row.append(tool(piece, { role, color }, t(`editorPiece_${color}_${role}`)));
    }
    palette.append(row);
  }
  const actionsRow = document.createElement('div');
  actionsRow.className = 'editor-row';
  actionsRow.append(tool(t('editorErase'), 'erase', t('editorErase')));
  palette.append(actionsRow);

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
  setups.append(
    button(t('editorEmpty'), () => {
      api.set({ fen: EMPTY });
      update();
    }),
    button(t('editorStart'), () => {
      api.set({ fen: START });
      turn = 'w';
      refused.clear();
      update();
    }),
  );

  const turnLine = document.createElement('label');
  turnLine.className = 'choice';
  const turnName = document.createElement('span');
  turnName.className = 'choice-name';
  turnName.textContent = t('editorTurn');
  const turnSelect = document.createElement('select');
  for (const [value, key] of [
    ['w', 'editorTurnWhite'],
    ['b', 'editorTurnBlack'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = t(key);
    option.selected = value === turn;
    turnSelect.append(option);
  }
  turnSelect.addEventListener('change', () => {
    turn = turnSelect.value === 'b' ? 'b' : 'w';
    update();
  });
  turnLine.append(turnName, turnSelect);

  const castling = document.createElement('div');
  castling.className = 'editor-castling';

  const problem = document.createElement('p');
  problem.className = 'editor-problem';

  const playWhite = button(t('editorPlayWhite'), () => play('w'), 'primary');
  const playBlack = button(t('editorPlayBlack'), () => play('b'), 'primary');
  const cancel = button(t('settingsClose'), () => dialog.close());
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

  function fen(): string {
    const flags = possibleCastles()
      .filter((castle) => !refused.has(castle.flag))
      .map((castle) => castle.flag)
      .join('');
    return `${api.getFen()} ${turn} ${flags || '-'} - 0 1`;
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

  function update(): void {
    castling.replaceChildren();
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
      castling.append(line);
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

  dialog.append(title, boardEl, palette, setups, turnLine, castling, problem, playRow);
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
