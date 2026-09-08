import { t } from '../i18n/index.js';

/**
 * Crediti e licenze.
 *
 * Due cose diverse nello stesso pannello. Chi ha fatto il programma viene PRIMA delle
 * librerie che usa: e' l'informazione che un lettore cerca per prima, e la GPL vuole
 * comunque un titolare del copyright con nome e anno.
 *
 * Sulla riga del codice: il modello e' dichiarato come STRUMENTO, non come coautore.
 * L'autore e' chi ha deciso cosa il programma deve fare, ha stabilito i criteri
 * didattici, ha giudicato e corretto il risultato, e ne risponde; e' anche l'unico che
 * puo' essere titolare del diritto d'autore, che in Italia e negli Stati Uniti nasce
 * solo da un apporto creativo umano. Dichiararlo comunque e' onesto e ormai atteso.
 *
 * Il resto non e' una cortesia: Stockfish e chessground sono GPL-3.0, e un programma
 * che li include e li distribuisce eredita la licenza. Chi riceve il programma ha diritto di
 * sapere quali sono i suoi diritti e dove trovare il sorgente corrispondente.
 *
 * Il link al sorgente e' obbligatorio proprio come l'elenco: senza, l'obbligo della
 * GPL non e' soddisfatto. Vive in una costante perche' non e' una decisione grafica.
 */
export const SOURCE_URL = 'https://github.com/rpaulin56/basic-chess';

interface Credit {
  readonly name: string;
  /**
   * CHIAVE i18n di cosa fa questa libreria, non la frase gia' scritta.
   *
   * Erano frasi in italiano dentro il codice, e nel pannello inglese si leggeva
   * "Stockfish — motore di analisi" sotto un titolo che diceva "Credits and licences".
   * Un buco che c'era da sempre e che si notava solo aprendo i crediti nell'altra
   * lingua, cioe' quasi mai — e da ieri l'inglese e' la lingua di partenza.
   *
   * Il NOME della libreria e la LICENZA restano invece stringhe letterali: sono nomi
   * propri e identificatori di licenza, e tradurli sarebbe sbagliato.
   */
  readonly what: string;
  readonly licence: string;
  readonly url: string;
}

const CREDITS: readonly Credit[] = [
  {
    name: 'Stockfish',
    what: 'creditWhatEngine',
    licence: 'GPL-3.0',
    url: 'https://stockfishchess.org',
  },
  {
    name: 'chessground',
    what: 'creditWhatBoard',
    licence: 'GPL-3.0-or-later',
    url: 'https://github.com/lichess-org/chessground',
  },
  {
    name: 'chess.js',
    what: 'creditWhatRules',
    licence: 'BSD-2-Clause',
    url: 'https://github.com/jhlywa/chess.js',
  },
  {
    name: 'cburnett',
    what: 'creditWhatPieces',
    licence: 'CC BY-SA 3.0',
    url: 'https://en.wikipedia.org/wiki/User:Cburnett',
  },
  {
    name: 'lichess-org/chess-openings',
    what: 'creditWhatOpenings',
    licence: 'CC0',
    url: 'https://github.com/lichess-org/chess-openings',
  },
];

/** Costruisce il pannello, chiuso. Si apre dal titolo. */
export function createCredits(): HTMLElement {
  const details = document.createElement('details');
  details.className = 'credits';

  const summary = document.createElement('summary');
  summary.textContent = t('credits');
  details.append(summary);

  const authors = document.createElement('dl');
  authors.className = 'credits-authors';
  for (const [label, name] of [
    [t('creditsAuthorLabel'), t('creditsAuthorName')],
    [t('creditsCodeLabel'), t('creditsCodeName')],
  ]) {
    const term = document.createElement('dt');
    term.textContent = label!;
    const value = document.createElement('dd');
    value.textContent = name!;
    authors.append(term, value);
  }
  const copyright = document.createElement('p');
  copyright.className = 'credits-copyright';
  copyright.textContent = t('creditsCopyright');

  // La dedica sta con gli autori e non in fondo alle licenze: non e' una nota legale,
  // e da' il nome alla persona da cui viene tutto il resto.
  //
  // E' TRADOTTA, contrariamente a quanto avevo deciso all'inizio. La motivazione di
  // allora — "e' dedicata a una persona, tradurla sarebbe come tradurre un nome" —
  // non regge: il nome e' "Luisa Dordi" e quello resta uguale in ogni lingua, mentre
  // il resto e' una frase, e lasciata in italiano resta muta proprio nella lingua di
  // partenza del programma.
  const dedication = document.createElement('figure');
  dedication.className = 'credits-dedication';

  /*
   * La foto NON sta nel repository, e non e' una dimenticanza.
   *
   * Il repository e' pubblico e sotto GPL: una fotografia di famiglia non deve finire
   * nei cloni ne' sotto quella licenza. Vive sul server, fuori dalla cartella che ogni
   * pubblicazione cancella, e viene servita dallo stesso dominio — quindi nessuna
   * richiesta a terzi, come per tutto il resto del programma.
   *
   * `loading="lazy"`: i crediti nascono chiusi, e chi non li apre non ha motivo di
   * scaricare centotrenta kilobyte.
   */
  const portrait = document.createElement('img');
  portrait.className = 'credits-photo';
  portrait.src = '/static/nonna-luisa.jpg';
  portrait.alt = t('creditsPhotoAlt');
  portrait.loading = 'lazy';
  // Le misure sono dichiarate perche' il testo sotto non salti quando la foto arriva.
  portrait.width = 630;
  portrait.height = 800;

  const caption = document.createElement('figcaption');
  caption.textContent = t('creditsDedication');
  dedication.append(portrait, caption);

  // La fotografia non e' coperta dalla licenza del programma, e va detto: chi legge
  // "GPL" due righe sotto puo' ragionevolmente pensare che valga anche per lei.
  const photoRights = document.createElement('p');
  photoRights.className = 'credits-copyright';
  photoRights.textContent = t('creditsPhotoRights');

  details.append(authors, dedication, photoRights, copyright);

  const intro = document.createElement('p');
  intro.textContent = t('creditsIntro');
  details.append(intro);

  const list = document.createElement('ul');
  for (const credit of CREDITS) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = credit.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = credit.name;
    item.append(link, document.createTextNode(` — ${t(credit.what)} · ${credit.licence}`));
    list.append(item);
  }
  details.append(list);

  const source = document.createElement('p');
  const sourceLink = document.createElement('a');
  sourceLink.href = SOURCE_URL;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener';
  sourceLink.textContent = t('creditsSource');
  source.append(sourceLink);
  details.append(source);

  return details;
}
