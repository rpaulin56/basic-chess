# Basic Chess

Scacchiera didattica con tutor, pensata per la fascia bassa (indicativamente 600-1400 Elo)
e per chi riprende a giocare dopo anni. Funziona **interamente nel browser**: nessun
server, nessun account, nessun dato raccolto.

## Stato

- **Fase 1** — scacchiera, lista mosse a figure, PGN/FEN, rewind ✅
- **Fase 2** — motore Stockfish nel browser, valutazione continua, bot calibrato ✅
- **Fase 3** — rilevamento degli errori importanti (in probabilità di vittoria) ✅
- **Fase 4** — classificazione banale/tattico/strategico e visualizzazione
- **Fase 5** — euristiche posizionali, nomi delle aperture, libreria di finali

## Come si usa

```
npm install
npm run dev       # http://localhost:5190, raggiungibile anche dalla LAN
npm run build
```

`npm run calibrate` misura la forza reale di un livello del bot facendolo giocare
contro Stockfish limitato a un Elo noto. Vedi `scripts/calibrate.ts`.

## Licenza

Il motore di analisi è **Stockfish**, distribuito sotto **GPL-3.0**. Poiché
l'applicazione lo include e lo distribuisce, anche questo progetto è GPL-3.0-or-later.
In pratica: si può usare, modificare e ridistribuire liberamente, ma una eventuale
distribuzione pubblica deve restare open source con la stessa licenza.
