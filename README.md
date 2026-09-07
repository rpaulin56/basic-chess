# GrandmaChess

Scacchiera didattica con tutor, pensata per la fascia bassa (indicativamente 600-1400 Elo)
e per chi riprende a giocare dopo anni. Funziona **interamente nel browser**: nessun
server, nessun account, nessun dato raccolto.

Il nome viene dall'idea di come dovrebbe comportarsi il tutor: come un nonno o una
nonna che ti insegna a giocare. Autorevole perché gli concedi fiducia, non perché si
imponga; bonario ma senza lasciar correre per compiacerti; paziente, con tutto il
tempo del mondo, e mai arrabbiato. Il repository si chiama ancora `basic-chess`, che
per un repository va benissimo.

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

## Finali tipici

Quando la posizione diventa un finale con un nome — re e pedone contro re, torre e
pedone contro torre, alfieri di colore contrario — compare una scheda con il nome del
finale e due o tre link per studiarlo: Wikipedia (in italiano dove l'articolo esiste)
e le lezioni **ufficiali** di Lichess, che sono interattive.

Riconoscere il finale non richiede ne' motore ne' rete ne' tabelle: e' la firma di
materiale letta dal FEN. Le tablebase Syzygy servirebbero a un'altra cosa — dire se la
posizione e' vinta o patta — e sono state escluse per scelta: il programma non parla
con la rete, e un link che l'utente clicca non e' il programma che parla con la rete.

E' l'unico punto in cui il programma manda fuori, ed e' deliberato: sui finali
elementari esiste materiale fatto meglio di quanto potremmo farlo noi.

## "E adesso?"

Un pulsante che risponde alla domanda che ci si fa a fine apertura: *e adesso cosa
faccio?* Risponde su richiesta e mai di sua iniziativa — un tutor che parla anche
quando le mosse buone sono molte parlerebbe quasi sempre, e allora il suo silenzio
direbbe "qui ce n'e' una sola, cerca il colpo": si imparerebbe a leggere il tutor
invece della posizione.

La risposta arriva sempre in due tempi: prima **quante** mosse tengono, e solo se lo
chiedi **quali**. Fra i due clic c'e' l'unico momento in cui si puo' ancora provare a
rispondere da soli. L'elenco e' alfabetico e senza punteggi: ordinarlo per valore
creerebbe un podio, e un podio ha un vincitore.

In apertura la risposta viene dal **libro** e non dal motore: si guarda quali mosse
legali portano a una posizione che ha un nome, e le si elenca con il nome. Le mosse
note ma cattive vengono comunque scartate dal motore — da 1.e4 e5 2.Cf3 Cc6 la tabella
conosce anche 3.Cxe5 (*Irish Gambit*), che regala un cavallo.

## Autore

**Concept e progetto software:** Riccardo Paulin
**Scrittura del codice:** Claude (Anthropic), sotto la direzione dell'autore

Il modello e' dichiarato come strumento, non come coautore: l'autore e' chi ha deciso
cosa il programma deve fare, ha definito i criteri didattici (a partire dalla
classificazione degli errori in svista / tattico / strategico, che e' il cuore del
progetto), ha giudicato e corretto il risultato, e ne risponde. E' anche l'unico che
puo' esserne titolare del diritto d'autore, che in Italia come negli Stati Uniti nasce
solo da un apporto creativo umano.

## Licenza

Copyright (C) 2026 Riccardo Paulin.

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
