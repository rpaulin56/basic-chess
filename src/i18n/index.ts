/**
 * i18n minimale, predisposta fin dall'inizio.
 *
 * Non e' zelo prematuro: il target dichiarato include bambini e principianti, e i
 * testi del tutor (fase 4) saranno molte decine di stringhe generate da template.
 * Estrarle dopo costa dieci volte tanto che scriverle qui da subito.
 */
import { it } from './it.js';
import { en } from './en.js';
import { fr } from './fr.js';

export type Dict = Record<keyof typeof it, string>;
export type LocaleCode = 'it' | 'en' | 'fr';

const DICTS: Record<LocaleCode, Dict> = { it, en, fr };

/** Le lingue disponibili, nell'ordine in cui compaiono nel menu. */
export const LOCALES: readonly LocaleCode[] = ['it', 'en', 'fr'];

/**
 * Il nome di ogni lingua NELLA PROPRIA lingua, e mai tradotto.
 *
 * E' la regola piu' importante di un selettore di lingua: chi arriva su una lingua
 * che non legge deve poter riconoscere la propria. "Italiano" lo riconosce un
 * italiano dentro un'interfaccia in giapponese; "Italian" scritto in giapponese no.
 *
 * Per questo NON stanno nei dizionari: li' sarebbero tradotte, che e' esattamente
 * cio' che non deve succedere. Un nome di lingua e' un nome proprio.
 */
export const LOCALE_NAMES: Record<LocaleCode, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
};

let current: LocaleCode = detectLocale();

/**
 * La lingua di partenza e' l'INGLESE, e non quella del browser.
 *
 * Prima si seguiva `navigator.language`, che a un browser italiano dava l'italiano.
 * Sembra piu' gentile, e per un visitatore italiano lo e'; ma il programma sta su un
 * dominio proprio e si chiama GrandmaChess, e la maggioranza di chi lo aprira' non
 * parla italiano. Fra le due scelte, quella che scontenta meno persone e' l'inglese.
 *
 * Ed e' una scelta che si paga poco proprio perche' l'abbiamo presa insieme al
 * mappamondo nell'intestazione: cambiare lingua e' un tocco, sempre visibile, e non
 * una voce sepolta in una finestra di impostazioni.
 */
function detectLocale(): LocaleCode {
  const saved = localStorage.getItem('basic-chess:locale');
  if (saved === 'it' || saved === 'en' || saved === 'fr') return saved;
  return 'en';
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
export function t(key: keyof Dict | string, params: Record<string, string | number> = {}): string {
  const template =
    DICTS[current][key as keyof Dict] ?? it[key as keyof Dict] ?? String(key);
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
