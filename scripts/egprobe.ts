/**
 * Che finale c'e' dietro l'angolo, da riga di comando.
 *
 * Serve a controllare a mano cosa vede la scheda dei finali: quale finale riconosce
 * nella posizione data e in quali si puo' entrare con una mossa o con un cambio.
 *
 *   npm run egprobe -- "<FEN>"
 */
import { Chess } from 'chess.js';
import { classifyEndgame } from '../src/endgame/endgame.js';

const fen = process.argv[2];
if (!fen) {
  console.error('Uso: npm run egprobe -- "<FEN>"');
  process.exit(1);
}
console.log('posizione corrente:', classifyEndgame(fen)?.key ?? '(nessun finale tipico)');
const chess = new Chess(fen);
for (const move of chess.moves({ verbose: true })) {
  const after = new Chess(fen);
  after.move(move.san);
  const direct = classifyEndgame(after.fen());
  if (direct) {
    console.log(`  ${move.san} -> ${direct.key}`);
    continue;
  }
  if (!move.captured) continue;
  for (const reply of after.moves({ verbose: true })) {
    if (reply.to !== move.to) continue;
    const traded = new Chess(after.fen());
    traded.move(reply.san);
    const found = classifyEndgame(traded.fen());
    if (found) console.log(`  ${move.san} ${reply.san} -> ${found.key}`);
  }
}
