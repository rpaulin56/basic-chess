import { describe, expect, it } from 'vitest';
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
  });

  it('resta BANALE anche se il materiale viene recuperato altrove piu\' avanti', () => {
    // Regressione su un caso reale. La variante vera dopo 12.O-O e':
    //   Cxc6 c3 Ag7 cxb4 ...
    // Il Bianco si riprende UN pedone tre semi-mosse dopo, quindi il bilancio alla
    // FINE della linea e' invariato — e la prima versione del classificatore
    // concludeva "nessuna perdita di materiale", cioe' errore strategico. Ma il
    // pedone passato in c6, che era tutto il vantaggio, era sparito alla prima mossa.
    const result = classifyConsequence(AFTER_CASTLING, [
      'b8c6', 'c2c3', 'f8g7', 'c3b4', 'g8e7', 'b4b5',
    ]);
    expect(result!.category).toBe('banale');
    expect(result!.manifestAt).toBe(1);
    expect(result!.materialLoss).toBe(1);
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
  it('segue il pezzo attraverso piu\' mosse in una sola freccia', () => {
    // Il cavallo va da b8 a c6 e poi in d4: la freccia utile e' b8->d4.
    const arrows = transportArrows(AFTER_CASTLING, ['b8c6', 'h2h3', 'c6d4']);
    const knight = arrows.find((arrow) => arrow.orig === 'b8');
    expect(knight).toBeDefined();
    expect(knight!.dest).toBe('d4');
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
