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
  readonly what: string;
  readonly licence: string;
  readonly url: string;
}

const CREDITS: readonly Credit[] = [
  {
    name: 'Stockfish',
    what: 'motore di analisi',
    licence: 'GPL-3.0',
    url: 'https://stockfishchess.org',
  },
  {
    name: 'chessground',
    what: 'scacchiera',
    licence: 'GPL-3.0-or-later',
    url: 'https://github.com/lichess-org/chessground',
  },
  {
    name: 'chess.js',
    what: 'regole e notazione',
    licence: 'BSD-2-Clause',
    url: 'https://github.com/jhlywa/chess.js',
  },
  {
    name: 'cburnett',
    what: 'disegno dei pezzi',
    licence: 'CC BY-SA 3.0',
    url: 'https://en.wikipedia.org/wiki/User:Cburnett',
  },
  {
    name: 'lichess-org/chess-openings',
    what: 'nomi delle aperture',
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
  details.append(authors, copyright);

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
    item.append(link, document.createTextNode(` — ${credit.what} · ${credit.licence}`));
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
