/**
 * Rimette in codice il foglio tradotto.
 *
 *   npm run i18n:import -- --in traduzione-fr.csv --locale fr
 *
 * Scrive `src/i18n/fr.ts`. Le stringhe vengono citate con gli apici DOPPI e con le
 * virgolette doppie interne protette: in francese quasi una frase su tre contiene un
 * apostrofo, e in TypeScript un apostrofo dentro una stringa fra apici semplici la
 * chiude. E' esattamente il lavoro che non deve fare chi traduce.
 *
 * Le chiavi non tradotte vengono lasciate fuori: il dizionario ricade sull'italiano
 * (vedi i18n/index.ts), quindi una traduzione incompleta funziona lo stesso e si vede
 * subito cosa manca, invece di riempire i buchi con testo inglese travestito da
 * francese.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from '../src/i18n/it.js';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

/** Lettore CSV minimo ma corretto: virgolette doppie raddoppiate, campi multiriga. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const source = readFileSync(arg('in', 'traduzione.csv'), 'utf8').replace(/^﻿/, '');
const rows = parseCsv(source);
const header = rows.shift() ?? [];
const keyAt = header.findIndex((name) => name.trim().toLowerCase() === 'chiave');
const valueAt = header.findIndex((name) => name.trim().toUpperCase().startsWith('FRANCESE'));
if (keyAt === -1 || valueAt === -1) {
  console.error('Colonne "chiave" e "FRANCESE" non trovate nell’intestazione.');
  process.exit(1);
}

const known = new Set(Object.keys(it));
const lines: string[] = [];
let translated = 0;
let unknown = 0;

for (const row of rows) {
  const key = (row[keyAt] ?? '').trim();
  const value = (row[valueAt] ?? '').trim();
  if (!key || !value) continue;
  if (!known.has(key)) {
    console.warn(`chiave sconosciuta, ignorata: ${key}`);
    unknown++;
    continue;
  }
  // Segnaposto: se ne manca uno, il programma mostrera' "{count}" a un utente.
  for (const mark of new Set([...(it[key as keyof typeof it].matchAll(/\{\w+\}/g))].map((m) => m[0]))) {
    if (!value.includes(mark)) console.warn(`${key}: manca il segnaposto ${mark}`);
  }
  lines.push(`  ${key}: ${JSON.stringify(value)},`);
  translated++;
}

const locale = arg('locale', 'fr');
const file = [
  `/**`,
  ` * Traduzione ${locale.toUpperCase()}, generata da scripts/i18n-import.ts.`,
  ` *`,
  ` * Le chiavi mancanti ricadono sull'italiano (vedi i18n/index.ts): una traduzione`,
  ` * incompleta funziona lo stesso, e cio' che manca si vede.`,
  ` */`,
  `export const ${locale} = {`,
  ...lines,
  `} as const;`,
  ``,
].join('\r\n');

const out = `src/i18n/${locale}.ts`;
writeFileSync(out, file, 'utf8');
console.log(
  `${translated} stringhe tradotte su ${known.size} scritte in ${out}` +
    (unknown ? ` (${unknown} chiavi sconosciute ignorate)` : ''),
);
