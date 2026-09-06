# Basic Chess

Scacchiera didattica con tutor, pensata per la fascia bassa (indicativamente 600-1400 Elo)
e per chi riprende a giocare dopo anni. Funziona **interamente nel browser**: nessun
server, nessun account, nessun dato raccolto.

## Stato

- **Fase 1** — scacchiera, lista mosse a figure, PGN/FEN, rewind ✅
- **Fase 2** — motore Stockfish nel browser, valutazione continua, bot calibrato ✅
- **Fase 3** — rilevamento degli errori importanti (in aspettativa di vittoria) ✅
- **Fase 4** — classificazione banale/tattico/strategico e visualizzazione ✅
- **Fase 5** — euristiche posizionali ✅, nomi delle aperture ✅, libreria di finali (da fare)

## Online

https://scacchi.riccardopaulin.com — sito statico sul VPS personale, nessun account,
nessun dato raccolto. Per pubblicare una nuova versione: `sh deploy/publish.sh`.

## Come si usa

```
npm install
npm run dev       # http://localhost:5190, raggiungibile anche dalla LAN
npm run build
```

`npm run calibrate` misura la forza reale di un livello del bot facendolo giocare
contro Stockfish limitato a un Elo noto. Vedi `scripts/calibrate.ts`.

## Licenza

**GPL-3.0-or-later** — testo completo in [LICENSE](LICENSE).

Non è una scelta stilistica: due delle librerie usate sono GPL-3.0 e un programma che
le include e le distribuisce eredita la licenza.

| componente | licenza |
|---|---|
| [Stockfish](https://stockfishchess.org) — motore di analisi | GPL-3.0 |
| [chessground](https://github.com/lichess-org/chessground) — scacchiera | GPL-3.0-or-later |
| [chess.js](https://github.com/jhlywa/chess.js) — regole e notazione | BSD-2-Clause |
| pezzi cburnett (dentro chessground) | CC BY-SA 3.0 |
| [chess-openings](https://github.com/lichess-org/chess-openings) — nomi delle aperture | CC0 |

In pratica: si può usare, modificare e ridistribuire liberamente, ma chi riceve il
programma — anche solo aprendo il sito, perché il browser ne scarica il codice — ha
diritto al sorgente corrispondente. È il motivo per cui questo repository è pubblico e
il link compare nei crediti dentro l'applicazione.
