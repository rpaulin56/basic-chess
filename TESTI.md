# Testi di GranmaChess — revisione

Tutti i testi che l'utente puo' vedere, raggruppati per zona.
Scrivi la versione nuova nella terza colonna; lascia vuoto quello che va bene.

I `{nomi}` fra graffe sono valori sostituiti a runtime e vanno lasciati come sono.

## Interfaccia generale

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `appTitle` | Basic Chess | |
| `moves` | Mosse | |
| `noMoves` | Nessuna mossa giocata. | |
| `newGame` | Nuova partita | |
| `newGameConfirm` | Vuoi davvero ricominciare? La partita in corso va persa. | |
| `flipBoard` | Ruota scacchiera | |
| `first` | Inizio | |
| `previous` | Indietro | |
| `next` | Avanti | |
| `last` | Fine | |
| `takeBack` | Ritira mossa | |
| `settings` | Impostazioni | |
| `settingsClose` | Chiudi | |
| `showEval` | Mostra la valutazione sotto la scacchiera | |
| `showDepth` | Mostra anche la profondità di analisi | |
| `language` | Lingua | |
| `playerName` | Il tuo nome | |
| `levelTitle` | Forza del bot (Elo misurato) | |
| `playAs` | Giochi con | |
| `playAsWhite` | Giochi con il Bianco | |
| `playAsBlack` | Giochi con il Nero | |
| `distractionTitle` | Quanto è distratto l’avversario | |
| `distractionCareful` | attento | |
| `distractionSloppy` | distratto | |
| `copied` | Copiato negli appunti. | |
| `evalDepth` | profondità {depth} | |
| `analysing` | analisi… | |
| `thinking` | Il bot sta pensando… | |
| `engineLoading` | Carico il motore… | |
| `engineFailed` | Motore non disponibile: {error} | |

## Stato della partita

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `turnWhite` | Muove il Bianco | |
| `turnBlack` | Muove il Nero | |
| `checkmate` | Scacco matto: vince {winner}. | |
| `stalemate` | Stallo: patta. | |
| `insufficient` | Materiale insufficiente: patta. | |
| `threefold` | Terza ripetizione: patta. | |
| `fiftyMoves` | Regola delle 50 mosse: patta. | |
| `white` | il Bianco | |
| `black` | il Nero | |
| `promotionTitle` | Scegli il pezzo di promozione | |

## Import ed export

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `positionTitle` | Posizione: importa o esporta | |
| `importPosition` | Importa una posizione o una partita | |
| `importTitle` | Importa una posizione (FEN) o una partita (PGN) | |
| `importPrompt` | Incolla un FEN (una posizione) oppure un PGN (una partita): | |
| `importInvalid` | Testo non riconosciuto né come FEN né come PGN: {error} | |
| `importedFen` | Posizione caricata. | |
| `importedPgn` | Partita caricata: {count} semi-mosse. | |
| `overwriteFuture` | Stai guardando una posizione precedente. Giocando qui cancelli le {count} semi-mosse successive. Procedere? | |
| `exportPgn` | Esporta la partita (PGN) | |
| `exportFen` | Esporta la posizione (FEN) | |
| `exportTitle` | Esporta | |

## Tutor: intestazioni e verdetto

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `tutorBlunder` | Errore grave | |
| `tutorMistake` | Errore | |
| `tutorInaccuracy` | Imprecisione | |
| `severeTag` | grave | |
| `headBanale` | Svista | |
| `headTattico` | Errore tattico | |
| `headStrategico` | Errore strategico | |
| `tutorWinChange` | L’aspettativa di vittoria scende dal {before}% {to}. | |
| `crossWinToLoss` | Da netto vantaggio a netto svantaggio. | |
| `crossWinToDraw` | Da netto vantaggio a posizione pari. | |
| `crossDrawToLoss` | Da posizione pari a netto svantaggio. | |
| `tutorAlternatives` | Erano {count} le mosse che tenevano la posizione. | |
| `tutorAlternativeOne` | Solo una mossa teneva la posizione. | |
| `tutorMissedChance` | Il tuo avversario aveva appena sbagliato, e non ne hai approfittato. | |

## Tutor: cosa succede

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `catBanaleText` | La punizione è immediata: perdi {what}. | |
| `catBanaleCount` | La punizione è immediata: lo scambio ti costa {what}. | |
| `catTatticoText` | La punizione arriva {moves} mosse più avanti: perdi {what}. | |
| `catTatticoCount` | La punizione arriva {moves} mosse più avanti e ti costa {what}. | |
| `catStrategicoText` | Non perdi materiale, ma la posizione peggiora stabilmente. | |
| `mateNow` | Ti danno matto subito. | |
| `mateIn` | Ti danno matto in {moves} mosse. | |
| `lossExchange` | la qualità | |
| `equivalentOne` | l’equivalente di un pedone | |
| `equivalentMany` | l’equivalente di {count} pedoni | |
| `pieceP` | il pedone | |
| `piecePassed` | il pedone passato | |
| `pieceN` | il cavallo | |
| `pieceB` | l’alfiere | |
| `pieceR` | la torre | |
| `pieceQ` | la donna | |
| `pieceAt` | {piece} in {square} | |
| `pieceAnd` |  e  | |

## Tutor: perche' peggiora (errore strategico)

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `posKingShieldOne` | Il tuo re resta scoperto: davanti a lui manca un pedone di riparo. | |
| `posKingShield` | Il tuo re resta scoperto: davanti a lui mancano {count} pedoni di riparo. | |
| `posKingOpenFile` | Si apre una colonna verso il tuo re, e l’avversario ci ha già un pezzo pesante. | |
| `posKingAttack` | L’avversario prende il controllo delle case attorno al tuo re. | |
| `posOutpost` | Un cavallo avversario si installa nel tuo campo dove nessun pedone può scacciarlo. | |
| `posLostPassed` | Perdi il tuo pedone passato, che era la tua risorsa migliore. | |
| `posIsolated` | La tua struttura pedonale si indebolisce: ti resta un pedone isolato da difendere. | |
| `posDoubled` | I tuoi pedoni si doppiano, e diventano più difficili da far avanzare. | |
| `posBishopPair` | Cedi la coppia degli alfieri. | |
| `posMobility` | I tuoi pezzi perdono mobilità: hai molte meno mosse utili a disposizione. | |
| `posRookFile` | Perdi il controllo della colonna aperta che avevi conquistato. | |
| `posNothing` | La posizione peggiora senza un motivo che si possa indicare in una frase: guarda il diagramma. | |

## Tutor: bottoni e diagramma

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `tutorTakeBack` | Ritira e riprova | |
| `tutorContinue` | Tengo la mossa | |
| `tutorContinueTitle` | Il bot giocherà la confutazione mostrata. | |
| `tutorShowBest` | Mostra le mosse che tenevano | |
| `tutorBestWas` | La mossa migliore era {move}. | |
| `tutorBetterWere` | Tenevano la posizione: {moves}. La migliore era {best}. | |
| `tutorShowConsequence` | Mostra cosa succede | |
| `previewClose` | Torna alla partita | |
| `previewCaption` | Conseguenza dell’errore, semi-mossa {index} di {total} | |
| `previewStart` | Posizione dopo la tua mossa | |
| `tutorOn` | Tutor acceso | |
| `tutorOff` | Tutor spento | |

## "E adesso?"

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `hint` | E adesso? | |
| `hintHeading` | E adesso? | |
| `hintThinking` | Guardo la posizione… | |
| `hintBookOne` | Da qui la teoria conosce una sola continuazione. | |
| `hintBookMany` | Da qui la teoria conosce {count} continuazioni: sei a un bivio. | |
| `hintLeavingBook` | Da qui non c’è più teoria: si gioca. | |
| `hintOnly` | C’è una mossa sola che tiene la posizione. È una posizione tattica: prenditi il tempo di cercarla. | |
| `hintFew` | Le mosse che tengono sono {count}: la posizione è più delicata di quanto sembri. | |
| `hintMany` | Puoi giocare {count} mosse diverse senza rovinare niente. Qui non si tratta di trovare la mossa giusta, si tratta di scegliere un piano. | |
| `hintManyOpen` | Qui va bene quasi tutto: la posizione non si decide adesso, e non c’è una mossa da trovare. | |
| `hintNothing` | Qui non c’è più niente da tenere. | |
| `hintReveal` | Mostra le mosse | |
| `hintRevealOne` | Mostra la mossa | |
| `hintClose` | Chiudi | |
| `hintUnordered` | In ordine alfabetico: nessuna di queste è “la migliore”. | |
| `hintMore` | … e altre. | |

## "E adesso?": cosa guardare

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `orientKingExposed` | Il tuo re è scoperto: metterlo al sicuro viene prima di qualunque piano. | |
| `orientOutpost` | Un cavallo avversario è installato nel tuo campo e nessun pedone può scacciarlo: finché resta lì, ogni piano parte in svantaggio. | |
| `orientPassed` | Hai un pedone passato che l’avversario non ha: è una minaccia che cresce da sola. | |
| `orientOpenFile` | L’avversario controlla una colonna aperta e tu no: è lì che sta per succedere qualcosa. | |
| `orientBishopPair` | Hai la coppia degli alfieri: vale se la posizione si apre. | |
| `orientCramped` | I tuoi pezzi hanno molte meno mosse dei suoi: qualcuno non sta partecipando. | |
| `orientIsolated` | Ti resta un pedone isolato da difendere: tienine conto quando scegli i cambi. | |
| `orientNothing` | Non spicca nessuna caratteristica particolare. La domanda utile allora è un’altra: quale dei tuoi pezzi sta partecipando di meno, e come lo fai entrare in gioco? | |

## Finali tipici

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `endgameIntro` | Questo finale ha un nome e una teoria precisa: vale la pena impararla una volta per tutte. | |
| `endgameEnteringIntro` | Da qui un cambio porta in questo finale. Vale la pena sapere com’è fatto prima di entrarci: la domanda è se il cambio ti conviene. | |
| `endgameClose` | Non ora | |
| `endgamePractice` | da giocare | |
| `egKPvK` | Re e pedone contro re | |
| `egKQvK` | Matto con la donna | |
| `egKRvK` | Matto con la torre | |
| `egKBNvK` | Matto con alfiere e cavallo | |
| `egKNNvK` | Due cavalli contro il re solo | |
| `egKBBvK` | Matto con i due alfieri | |
| `egKQvKP` | Donna contro pedone | |
| `egKRPvKR` | Torre e pedone contro torre | |
| `egKRBvKR` | Torre e alfiere contro torre | |
| `egKQPvKQ` | Donna e pedone contro donna | |
| `egOppositeBishops` | Alfieri di colore contrario | |
| `egPawns` | Finale di pedoni | |
| `egRooks` | Finale di torri | |

## Mosse critiche (riepilogo)

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `recap` | Mosse critiche | |
| `recapLine` | {number} {san} — {kind}, {severity}: {what} ({state}) | |
| `recapCorrected` | ritirata | |
| `recapKept` | tenuta | |
| `recapHints` | Aiuti chiesti in questa partita: {count}. | |

## Crediti

| chiave | testo attuale | come lo diresti |
|---|---|---|
| `credits` | Crediti e licenze | |
| `creditsIntro` | Questo programma è software libero, e lo è per obbligo oltre che per scelta: usa Stockfish e chessground, entrambi sotto licenza GPL-3.0. | |
| `creditsSource` | Codice sorgente | |
| `creditsClose` | Chiudi | |
| `creditsAuthorLabel` | Concept e progetto software | |
| `creditsAuthorName` | Riccardo Paulin | |
| `creditsCodeLabel` | Scrittura del codice | |
| `creditsCodeName` | Claude (Anthropic), sotto la direzione dell’autore | |
| `creditsCopyright` | © 2026 Riccardo Paulin — GPL-3.0-or-later | |

## Da cancellare (non li usa piu' nessuno)

Erano le annotazioni del PGN, che adesso si scrivono in inglese direttamente nel
codice. Non compaiono da nessuna parte: verificato, zero riferimenti.

| chiave | testo attuale |
|---|---|
| `annotationKept` | mossa tenuta |
| `annotationUndone` | qui avevi giocato {move}, poi ritirata |
| `annotationLine` | {kind}, {severity}: {what} punti di aspettativa, {state}. |
| `annotationTheory` | {name}: ultima posizione riconosciuta dalla teoria. |
