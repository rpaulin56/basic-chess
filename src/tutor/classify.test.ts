import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { classifyConsequence, transportArrows } from './classify.js';

/**
 * I casi di prova vengono da una partita vera dell'utente (quella con il pedone in
 * c6), non da posizioni inventate: e' l'unico modo per sapere se la classificazione
 * dice qualcosa di sensato a chi sta giocando davvero.
 */

// Dopo 12.O-O: il pedone passato in c6 e' indifeso e il cavallo se lo prende subito.
const AFTER_CASTLING = 'rnq1kbnr/p4p2/2P1p1p1/5b1p/Np3B2/1B1P1Q2/PPP1NPPP/R4RK1 b kq - 3 12';

// Dopo 8...h5: la conseguenza (la torre in a8) arriva sette semi-mosse dopo.
const AFTER_H5 = 'rnq1kbnr/p3pp2/2P3p1/5b1p/Np6/1B3Q2/PPPP1PPP/R1B1K1NR w KQkq - 0 9';

describe('classifyConsequence', () => {
  it('riconosce come BANALE un pedone lasciato in presa', () => {
    const result = classifyConsequence(AFTER_CASTLING, ['b8c6']);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('banale');
    expect(result!.manifestAt).toBe(1);
    expect(result!.materialLoss).toBe(1);
    expect(result!.san).toEqual(['Nxc6']);
  });

  it('riconosce come TATTICO un guadagno che matura qualche mossa dopo', () => {
    // c7 spinge, il cavallo e' costretto a prenderlo, l'alfiere entra con scacco e
    // porta via la torre in a8: la perdita si vede solo alla fine.
    const result = classifyConsequence(AFTER_H5, [
      'c6c7', 'b8a6', 'b3d5', 'a6c7', 'd5c6', 'e8d8', 'c6a8',
    ]);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('tattico');
    expect(result!.manifestAt).toBeGreaterThan(1);
    // Torre (5) contro il pedone c7 (1) che l'avversario perde per strada.
    expect(result!.materialLoss).toBeGreaterThanOrEqual(4);
    // Il compenso e' un pedone soltanto, quindi la torre si puo' nominare: "perdi la
    // torre in a8" si legge meglio di "l'equivalente di quattro pedoni".
    expect(result!.lossKind).toBe('named');
    expect(result!.lost.map((piece) => `${piece.type}${piece.square}`)).toEqual(['ra8']);
  });

  it('non chiama perdita di materiale un pedone ceduto e uno ripreso', () => {
    // Caso reale, dopo 12.O-O: Cxc6 c3 Ag7 cxb4 — il Nero prende il pedone passato in
    // c6 e il Bianco ne recupera un altro tre semi-mosse dopo. Il SALDO e' pari, e
    // dire "perdi un pedone" sarebbe falso.
    //
    // Che il pedone perduto fosse quello PASSATO — cioe' l'unica cosa che contava — e'
    // un giudizio posizionale, non materiale, e lo dice positional.ts con "perdi il
    // tuo pedone passato". Una versione precedente lo trattava come perdita materiale
    // prendendo il MINIMO lungo la variante, e proprio per questo su un'altra partita
    // annunciava "perdi il cavallo in c3" quando il cavallo veniva ripagato poco dopo.
    const result = classifyConsequence(AFTER_CASTLING, [
      'b8c6', 'c2c3', 'f8g7', 'c3b4', 'g8e7', 'b4b5',
    ]);
    expect(result!.category).toBe('strategico');
    expect(result!.materialLoss).toBe(0);
  });

  it('aspetta il compenso che arriva con una mossa intermedia', () => {
    // Regressione sul caso segnalato dall'utente. Dopo 8.a3 la confutazione e'
    //   Axc3 Aa2 Axd4 Cxd4 ...
    // Il cavallo in c3 sparisce alla PRIMA semi-mossa, ma il Bianco non ricattura
    // subito: si ritira e recupera un pezzo due semi-mosse dopo. Il conto vero e' un
    // pedone, non un cavallo, e la conseguenza si manifesta alla quarta semi-mossa.
    // Una regola che pretende la ricattura immediata sbaglia ogni volta che c'e' di
    // mezzo una mossa intermedia — e a scacchi ce n'e' di mezzo continuamente.
    const AFTER_A3 = 'r1bqk1nr/1pp2ppp/p3p3/n7/1bBPP3/P1N2N2/1P3PPP/R1BQ1RK1 b kq - 0 8';
    const result = classifyConsequence(AFTER_A3, [
      'b4c3', 'c4a2', 'c3d4', 'f3d4', 'c7c5', 'd4e2', 'd8d1', 'f1d1',
    ]);
    expect(result!.materialLoss).toBe(1);
    expect(result!.manifestAt).toBe(4);
    expect(result!.category).toBe('tattico');
  });

  it('non scambia un cambio normale per una perdita', () => {
    // L'avversario prende e noi ricatturiamo: il materiale torna pari alla prima
    // posizione assestata, quindi non c'e' nessuna perdita da segnalare.
    const result = classifyConsequence(AFTER_CASTLING, ['f5d3', 'c2d3']);
    expect(result!.category).toBe('strategico');
    expect(result!.materialLoss).toBe(0);
  });

  it('riconosce come STRATEGICO un peggioramento senza perdita di materiale', () => {
    // Mosse di sviluppo da entrambe le parti: nessuno prende niente.
    const result = classifyConsequence(AFTER_CASTLING, ['f8g7', 'a2a3', 'g8e7', 'a3b4']);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('strategico');
    expect(result!.materialLoss).toBe(0);
  });

  it('non produce nulla se la linea non e\' rigiocabile', () => {
    expect(classifyConsequence(AFTER_CASTLING, ['a1a8'])).toBeNull();
  });

  it('tronca la variante alla posizione che la manifesta', () => {
    // Anche passando una linea lunga, la conseguenza si ferma dove si capisce.
    const result = classifyConsequence(AFTER_CASTLING, ['b8c6', 'h2h3', 'f8g7', 'a2a3']);
    expect(result!.san).toEqual(['Nxc6']);
    expect(result!.line).toHaveLength(1);
  });
});

describe('transportArrows', () => {
  it('disegna una freccia per semi-mossa, concatenate sullo stesso pezzo', () => {
    // Il cavallo va da b8 a c6 e poi in d4: si vedono DUE frecce agganciate, non una
    // sola da b8 a d4. La freccia unica sembrava piu' pulita ma nascondeva il
    // percorso, che e' proprio la cosa da imparare.
    const arrows = transportArrows(AFTER_CASTLING, ['b8c6', 'h2h3', 'c6d4']);
    const legs = arrows.filter((arrow) => arrow.orig !== arrow.dest);
    expect(legs.map((arrow) => `${arrow.orig}${arrow.dest}`)).toEqual(['b8c6', 'h2h3', 'c6d4']);
  });

  it('colora i pezzi secondo il proprietario', () => {
    // Dopo 12.O-O tocca al Nero, quindi chi ha sbagliato e' il Bianco: le sue frecce
    // sono blu, quelle dell'avversario rosse.
    const arrows = transportArrows(AFTER_CASTLING, ['b8c6', 'h2h3']);
    expect(arrows.find((a) => a.orig === 'b8')!.brush).toBe('red');
    expect(arrows.find((a) => a.orig === 'h2')!.brush).toBe('blue');
  });

  it('segnala con un cerchio i pezzi che perdiamo', () => {
    // Il pedone in c6 e' del Bianco (la vittima) e viene catturato: cerchio su c6.
    const arrows = transportArrows(AFTER_CASTLING, ['b8c6']);
    const circle = arrows.find((arrow) => arrow.orig === arrow.dest);
    expect(circle).toBeDefined();
    expect(circle!.orig).toBe('c6');
    expect(circle!.brush).toBe('yellow');
  });
});

describe('nomi dei pezzi perduti', () => {
  it('riconosce un pedone passato e lo distingue da un pedone qualunque', () => {
    // Il pedone in c6 e' passato (nessun pedone nero su b, c o d davanti a lui):
    // "perdi il pedone passato in c6" dice molto piu' di "perdi un pedone".
    const result = classifyConsequence(AFTER_CASTLING, ['b8c6']);
    expect(result!.lost).toHaveLength(1);
    expect(result!.lost[0]!.type).toBe('p');
    expect(result!.lost[0]!.square).toBe('c6');
    expect(result!.lost[0]!.passed).toBe(true);
  });

  it('nomina tutti i pezzi persi quando non c\'e\' compenso', () => {
    // Cxc6 (via il pedone passato) e poi Ad6 Axd6 (via l'alfiere): il Bianco non
    // riprende niente, quindi entrambe le perdite si possono nominare.
    const result = classifyConsequence(AFTER_CASTLING, ['b8c6', 'f4d6', 'f8d6']);
    expect(result!.lost.map((piece) => piece.type)).toEqual(['p', 'b']);
    expect(result!.materialLoss).toBe(4);
  });

  it('non nomina i pezzi quando la perdita e\' il saldo di uno scambio', () => {
    // L'alfiere nero prende in d3 e il pedone ricattura: il Bianco perde un pedone ma
    // guadagna un alfiere. Dire "perdi il pedone in d3" sarebbe vero e fuorviante
    // insieme, quindi la lista dei nomi resta vuota e si ripiega sul conteggio.
    const result = classifyConsequence(AFTER_CASTLING, ['f5d3', 'c2d3']);
    expect(result!.lost).toEqual([]);
  });
});

describe('la qualità', () => {
  // Torre contro pezzo leggero ha un nome che ogni giocatore usa: "perdi la qualità"
  // dice molto piu' di "l'equivalente di due pedoni".
  const ROOK_VS_BISHOP = '4k3/8/8/8/8/1b6/8/3RK3 b - - 0 1';

  it('riconosce torre contro alfiere come perdita della qualità', () => {
    const result = classifyConsequence(ROOK_VS_BISHOP, ['b3d1', 'e1d1']);
    expect(result!.lossKind).toBe('exchange');
    expect(result!.materialLoss).toBe(2);
    // I nomi non si usano: dire "perdi la torre" nasconderebbe che un alfiere lo
    // abbiamo preso.
    expect(result!.lost).toEqual([]);
  });

  it('non chiama qualità uno scambio sbilanciato piu\' complesso', () => {
    // Due pezzi leggeri per la torre non ha un nome breve: resta il conteggio.
    const result = classifyConsequence(ROOK_VS_BISHOP, ['b3d1']);
    expect(result!.lossKind).toBe('named');
  });
});

describe('il matto', () => {
  // Matto del barbiere: dopo 3...Cf6?? il Bianco matta con Dxf7.
  const SCHOLAR = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

  it('riconosce il matto e lo antepone al conteggio del materiale', () => {
    const result = classifyConsequence(SCHOLAR, ['h5f7']);
    expect(result!.matesIn).toBe(1);
    // La variante si ferma al matto, non prosegue per contare i pedoni.
    expect(result!.manifestAt).toBe(1);
  });
});

describe('semplificazione dei cambi alla pari', () => {
  it('nomina il pezzo che resta davvero dopo aver cancellato i cambi', () => {
    // Caso reale, dopo 8.a3: Axc3 Aa2 Axd4 Cxd4 ... Dxd1 Txd1.
    // Il Bianco cede cavallo, pedone e donna e prende alfiere e donna: donna contro
    // donna e cavallo contro alfiere si cancellano, e cio' che resta e' IL PEDONE IN
    // D4. Dire "l'equivalente di un pedone" era vero ma non diceva dove guardare.
    const AFTER_A3 = 'r1bqk1nr/1pp2ppp/p3p3/n7/1bBPP3/P1N2N2/1P3PPP/R1BQ1RK1 b kq - 0 8';
    const result = classifyConsequence(AFTER_A3, [
      'b4c3', 'c4a2', 'c3d4', 'f3d4', 'c7c5', 'd4e2', 'd8d1', 'f1d1',
    ]);
    expect(result!.lossKind).toBe('named');
    expect(result!.lost.map((piece) => `${piece.type}${piece.square}`)).toEqual(['pd4']);
  });
});

describe('un cambio in corso non e\' un recupero', () => {
  it("l'Alfiere perso subito resta una svista anche se dopo si cambiano i pedoni", () => {
    // Partita di prova: 1.e4 e6 2.Ba6?? Nxa6, e la linea del motore interrotta a
    // profondita' 14 prosegue con exd5 exd5. Prima questa linea dava "tattico, la
    // conseguenza arriva tra quattro mosse".
    const fen = 'rnbqkbnr/pppp1ppp/B3p3/8/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2';
    const line = ['b8a6', 'd2d4', 'f8e7', 'b1c3', 'd7d5', 'e4d5', 'e6d5', 'g1f3'];
    const consequence = classifyConsequence(fen, line);
    expect(consequence?.category).toBe('banale');
    expect(consequence?.manifestAt).toBe(1);
  });
});

/**
 * Un Alfiere perso alla prima risposta si vede alla prima risposta.
 *
 * Partita vera: 1.d4 d5 2.Nf3 e6 3.c4 h6 4.Bf4 Be7 5.Nc3 dxc4 6.e4 Nd7 7.Bxc4 g5 8.O-O c6
 * 9.Be3 Ngf6 10.Bxe6? fxe6. Il tutor annunciava "tra quattro mosse perdi l'Alfiere", e in
 * un'altra variante del motore addirittura "errore strategico".
 */
describe('una perdita subita resta subita', () => {
  const game = new Chess();
  for (const san of 'd4 d5 Nf3 e6 c4 h6 Bf4 Be7 Nc3 dxc4 e4 Nd7 Bxc4 g5 O-O c6 Be3 Ngf6 Bxe6'.split(' ')) {
    game.move(san);
  }
  const AFTER_BXE6 = game.fen();

  it('non chiude il conto a meta\' di un cambio, oltre l\'orizzonte', () => {
    // All'ottava semi-mossa Bxf4, e la ripresa gxf4 e' la nona.
    const result = classifyConsequence(AFTER_BXE6, [
      'f7e6', 'd1c2', 'f6h5', 'e4e5', 'd7f8', 'a1d1', 'h5f4', 'e3f4', 'g5f4',
    ]);
    expect(result!.category).toBe('banale');
    expect(result!.manifestAt).toBe(1);
    expect(result!.materialLoss).toBe(3);
    expect(result!.lost.map((piece) => `${piece.type}${piece.square}`)).toEqual(['be6']);
  });

  it('un pedone guadagnato di passaggio non sposta il momento della perdita', () => {
    // Dopo fxe6, Bxg5 prende un pedone e Nxe4 ne riprende un altro su un'altra casa.
    const result = classifyConsequence(AFTER_BXE6, ['f7e6', 'e3g5', 'f6e4']);
    expect(result!.category).toBe('banale');
    expect(result!.manifestAt).toBe(1);
    expect(result!.materialLoss).toBe(3);
  });
});

describe('una perdita piccola dopo quella grossa non sposta il momento', () => {
  it('la Donna persa subito resta "subito" anche se dopo si perde un pedone', () => {
    // 1.e4 e5 2.Qh5 Nc6 3.Qxf7+?? Kxf7 4.d4 Nxd4: la variante perde anche il pedone d4.
    // Prima: "tra due mosse perdi la Donna e il pedone".
    const game = new Chess();
    for (const san of 'e4 e5 Qh5 Nc6 Qxf7+'.split(' ')) game.move(san);
    const result = classifyConsequence(game.fen(), ['e8f7', 'd2d4', 'c6d4']);
    expect(result!.category).toBe('banale');
    expect(result!.manifestAt).toBe(1);
    expect(result!.lost.map((piece) => `${piece.type}${piece.square}`)).toEqual(['qf7']);
  });
});
