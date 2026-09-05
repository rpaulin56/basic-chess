/**
 * i18n minimale, predisposta fin dall'inizio.
 *
 * Non e' zelo prematuro: il target dichiarato include bambini e principianti, e i
 * testi del tutor (fase 4) saranno molte decine di stringhe generate da template.
 * Estrarle dopo costa dieci volte tanto che scriverle qui da subito.
 */
import { it } from './it.js';
import { en } from './en.js';

export type Dict = Record<keyof typeof it, string>;
export type LocaleCode = 'it' | 'en';

const DICTS: Record<LocaleCode, Dict> = { it, en };

let current: LocaleCode = detectLocale();

function detectLocale(): LocaleCode {
  const saved = localStorage.getItem('basic-chess:locale');
  if (saved === 'it' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en';
}

export function locale(): LocaleCode {
  return current;
}

export function setLocale(code: LocaleCode): void {
  current = code;
  localStorage.setItem('basic-chess:locale', code);
}

/**
 * Traduce una chiave, con interpolazione di `{nome}`.
 * Se la chiave manca nella lingua corrente si ricade sull'italiano (lingua di
 * riferimento del progetto), e in ultima istanza sulla chiave stessa: un testo
 * brutto e' meglio di una schermata vuota.
 */
export function t(key: keyof Dict, params: Record<string, string | number> = {}): string {
  const template = DICTS[current][key] ?? it[key] ?? String(key);
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
