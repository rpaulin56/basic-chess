/**
 * Prepara il foglio di lavoro per chi traduce il programma in una lingua nuova.
 *
 *   npm run i18n:export -- --out traduzione.csv        (contesto in italiano)
 *   npm run i18n:export -- --fr --out traduction.csv   (contesto in francese)
 *
 * Perche' un CSV e non il file `.ts` da compilare: chi traduce non deve toccare il
 * codice. In francese, in inglese e in mezza Europa le stringhe sono piene di
 * apostrofi, e in un file TypeScript un apostrofo dentro una stringa fra apici chiude
 * la stringa e rompe la compilazione. Quel problema resta nostro: si riporta indietro
 * con `i18n:import`, che sa come citare.
 *
 * Il foglio non porta solo le stringhe: porta il CONTESTO. Una traduzione fatta su un
 * elenco di frasi senza sapere chi le dice e dove compaiono produce un'interfaccia che
 * suona sbagliata pur essendo corretta — ed e' esattamente cio' che qui non vogliamo,
 * perche' meta' di questi testi sono la voce di un personaggio.
 */
import { writeFileSync } from 'node:fs';
import { it } from '../src/i18n/it.js';
import { en } from '../src/i18n/en.js';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

/**
 * Da che parte del programma viene una chiave, riconosciuta dal prefisso, in italiano
 * e nella lingua di chi traduce.
 *
 * L'ordine conta: si prende la PRIMA regola che combacia, quindi le piu' specifiche
 * stanno prima. E' una mappa scritta a mano perche' il contesto non si deduce dal
 * nome: `orientKingActive` e `posKingShield` cominciano diversi e vivono nello stesso
 * pannello.
 *
 * Tradotta anche lei: sono duecento righe di spiegazioni, e lasciarle in una lingua
 * che chi traduce legge a fatica vanifica meta' del motivo per cui esistono.
 */
const CONTEXTS: readonly [RegExp, string, string][] = [
  [/^tutor/,
   'Pannello della Nonna quando segnala un errore. E’ lei che parla, in prima persona.',
   'Panneau de Mamie quand elle signale une erreur. C’est elle qui parle, à la première personne.'],
  [/^(cat|pos|piece|equivalent|mate|cross|head)/,
   'Frasi con cui la Nonna spiega un errore. Voce della Nonna.',
   'Phrases par lesquelles Mamie explique une erreur. C’est sa voix.'],
  [/^orient/,
   '"E adesso?": la Nonna descrive la posizione quando le mosse buone sono molte.',
   '« Et maintenant ? » : Mamie décrit la position quand les bons coups sont nombreux.'],
  [/^hint/,
   '"E adesso?": quante e quali mosse tengono la posizione.',
   '« Et maintenant ? » : combien de coups tiennent la position, et lesquels.'],
  [/^why/,
   'Analisi di fine partita. Voce della Nonna.',
   'Analyse de fin de partie. C’est la voix de Mamie.'],
  [/^recap/,
   'Riepilogo degli errori della partita, nella colonna di destra.',
   'Récapitulatif des erreurs de la partie, dans la colonne de droite.'],
  [/^(resign|draw|offer|outcome)/,
   'Abbandono e offerta di patta, con il giudizio della Nonna.',
   'Abandon et proposition de nulle, avec l’avis de Mamie.'],
  [/^eg/,
   'Nomi dei finali teorici e schede di studio.',
   'Noms des finales théoriques et fiches d’étude.'],
  [/^opponentHelp/,
   'Finestra "?" che spiega come scegliere il livello e la distrazione.',
   'Fenêtre « ? » qui explique comment choisir le niveau et la distraction.'],
  [/^(level|distraction|playAs)/,
   'Scelta dell’avversaria, sotto la scacchiera.',
   'Choix de l’adversaire, sous l’échiquier.'],
  [/^credits?/,
   'Pannello dei crediti e delle licenze.',
   'Panneau des crédits et des licences.'],
  [/^(show|settings|language)/,
   'Finestra delle impostazioni.',
   'Fenêtre des réglages.'],
  [/^(import|export|position|copied|overwrite)/,
   'Menu per far entrare e uscire posizioni e partite.',
   'Menu pour importer et exporter positions et parties.'],
  [/^(rewind|turn|thinking|checkmate|stalemate|draw|newGame|recover|first|last|previous|next|flip|takeBack|moves|noMoves|opening)/,
   'Comandi e riga di stato sotto la scacchiera. Spazio stretto.',
   'Commandes et ligne d’état sous l’échiquier. Place très limitée.'],
  [/^(engine|analysing|eval)/,
   'Riga della valutazione sotto la scacchiera. Spazio stretto.',
   'Ligne d’évaluation sous l’échiquier. Place très limitée.'],
  [/^app|^tagline/,
   'Intestazione della pagina.',
   'En-tête de la page.'],
];

/** Vero quando il foglio si prepara per chi traduce, invece che per noi. */
const french = process.argv.includes('--fr');

function contextOf(key: string): string {
  for (const [pattern, italian, translated] of CONTEXTS) {
    if (pattern.test(key)) return french ? translated : italian;
  }
  return french ? 'Divers.' : 'Varie.';
}

/** I segnaposto vanno ricopiati IDENTICI: sono buchi che il programma riempie. */
function placeholders(text: string): string {
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[0]);
  return [...new Set(found)].join(' ');
}

/** Una cella CSV: le virgolette si raddoppiano, e tutto sta fra virgolette. */
function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const rows = [
  french
    ? ['chiave', 'où cela apparaît', 'italien (original)', 'anglais', 'FRANCESE (à remplir)', 'balises', 'notes']
    : ['chiave', 'dove compare', 'italiano', 'inglese', 'FRANCESE (da riempire)', 'segnaposto', 'note'],
];

for (const key of Object.keys(it) as (keyof typeof it)[]) {
  const italian = it[key];
  const english = en[key] ?? '';
  const marks = placeholders(italian);
  const notes: string[] = [];
  if (marks) {
    notes.push(french ? 'Recopie les balises à l’identique.' : 'Ricopia i segnaposto identici.');
  }
  // Sotto i venticinque caratteri e' quasi sempre un pulsante o un'etichetta: il
  // francese e' mediamente piu' lungo dell'italiano, e li' non c'e' spazio.
  if (italian.length <= 25) {
    notes.push(
      french
        ? 'Place limitée : reste aussi court que l’original.'
        : 'Spazio stretto: tieniti corta come l’originale.',
    );
  }
  rows.push([key, contextOf(key), italian, english, '', marks, notes.join(' ')]);
}

const out = arg('out', 'traduzione.csv');
// BOM: senza, Excel apre un CSV UTF-8 con gli accenti sbagliati, ed e' la prima cosa
// che succederebbe a chi riceve il file.
writeFileSync(out, '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n'), 'utf8');
console.log(`${rows.length - 1} stringhe scritte in ${out}`);
