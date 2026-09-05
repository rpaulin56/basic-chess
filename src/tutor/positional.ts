import type { Color } from 'chess.js';
import { features, type Features } from './features.js';

/**
 * Spiegazione a parole dell'errore STRATEGICO.
 *
 * Scelta di progetto dell'utente: SOLE EURISTICHE, niente modelli linguistici, niente
 * rete. Il prezzo e' un tetto qualitativo — queste frasi dicono bene "hai ceduto una
 * casa forte" e non diranno mai "il tuo piano era sbagliato" — e il guadagno e' che
 * il programma resta un file statico che funziona anche fra dieci anni.
 *
 * Il metodo: si confrontano le caratteristiche della posizione PRIMA della mossa con
 * quelle della posizione futura in cui la conseguenza si manifesta, e si raccontano
 * solo i due o tre cambiamenti piu' grossi. Elencarli tutti sarebbe un referto, non
 * una spiegazione.
 */

export interface Explanation {
  /** Chiave i18n della frase. */
  readonly key: string;
  readonly params: Record<string, string | number>;
  /** Quanto pesa: serve solo a ordinare, non viene mostrato. */
  readonly weight: number;
}

/** Una regola: guarda due misurazioni e, se c'e' qualcosa da dire, lo dice. */
interface Rule {
  readonly test: (before: Features, after: Features) => Explanation | null;
}

/** Peso di una differenza, con una soglia sotto la quale non vale la pena parlarne. */
function worse(before: number, after: number, threshold: number): number {
  const delta = before - after;
  return delta >= threshold ? delta : 0;
}

const RULES: readonly Rule[] = [
  {
    // Il re scoperto e' quasi sempre la cosa piu' importante da dire, quindi pesa piu'
    // delle altre a parita' di variazione.
    test: (before, after) => {
      const delta = worse(before.kingShield, after.kingShield, 1);
      if (!delta) return null;
      // Chiave diversa al singolare: "mancano 1 pedoni" e' il tipo di sciatteria che
      // fa sembrare automatico un testo che vorrebbe insegnare qualcosa.
      return delta === 1
        ? { key: 'posKingShieldOne', params: {}, weight: 3 }
        : { key: 'posKingShield', params: { count: delta }, weight: delta * 3 };
    },
  },
  {
    test: (before, after) => {
      const delta = worse(after.kingOpenFiles * -1, before.kingOpenFiles * -1, 1);
      return delta ? { key: 'posKingOpenFile', params: {}, weight: delta * 3 } : null;
    },
  },
  {
    test: (before, after) => {
      const delta = worse(after.kingAttackers * -1, before.kingAttackers * -1, 2);
      return delta ? { key: 'posKingAttack', params: {}, weight: delta * 1.5 } : null;
    },
  },
  {
    test: (before, after) => {
      const delta = worse(after.enemyOutposts * -1, before.enemyOutposts * -1, 1);
      return delta ? { key: 'posOutpost', params: {}, weight: delta * 2.5 } : null;
    },
  },
  {
    test: (before, after) => {
      const delta = worse(before.passedPawns, after.passedPawns, 1);
      return delta ? { key: 'posLostPassed', params: {}, weight: delta * 3 } : null;
    },
  },
  {
    test: (before, after) => {
      const delta = worse(after.isolatedPawns * -1, before.isolatedPawns * -1, 1);
      return delta ? { key: 'posIsolated', params: {}, weight: delta * 1.5 } : null;
    },
  },
  {
    test: (before, after) => {
      const delta = worse(after.doubledPawns * -1, before.doubledPawns * -1, 1);
      return delta ? { key: 'posDoubled', params: {}, weight: delta * 1.2 } : null;
    },
  },
  {
    test: (before, after) =>
      before.bishopPair && !after.bishopPair
        ? { key: 'posBishopPair', params: {}, weight: 2 }
        : null,
  },
  {
    // La mobilita' e' rumorosa: serve un crollo vero per dire qualcosa.
    test: (before, after) => {
      const delta = worse(before.mobility, after.mobility, 6);
      return delta ? { key: 'posMobility', params: {}, weight: delta * 0.4 } : null;
    },
  },
  {
    test: (before, after) => {
      const delta = worse(before.rooksOnOpenFiles, after.rooksOnOpenFiles, 1);
      return delta ? { key: 'posRookFile', params: {}, weight: delta } : null;
    },
  },
];

/**
 * Confronta la posizione prima dell'errore con quella futura e restituisce al massimo
 * `limit` frasi, dalla piu' importante.
 *
 * Se non trova niente restituisce una lista vuota: e' un esito legittimo e frequente.
 * Meglio tacere che inventare una spiegazione — un tutor che dice cose vaghe smette
 * di essere creduto, ed e' il modo piu' rapido per rendere inutile tutto il progetto.
 */
export function explainPositional(
  fenBefore: string,
  fenFuture: string,
  victim: Color,
  limit = 2,
): Explanation[] {
  const before = features(fenBefore, victim);
  const after = features(fenFuture, victim);
  return RULES.map((rule) => rule.test(before, after))
    .filter((explanation): explanation is Explanation => explanation !== null)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}
