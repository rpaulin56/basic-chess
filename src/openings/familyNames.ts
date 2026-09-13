import { locale } from '../i18n/index.js';

/**
 * I nomi delle aperture nella lingua di chi gioca — ma solo la FAMIGLIA.
 *
 * "Sicilian Defense: Najdorf Variation" diventa "Difesa Siciliana: Najdorf Variation", e
 * non e' una traduzione a meta' per pigrizia: e' la scelta giusta per tutte e due le
 * parti. La famiglia e' quello che un principiante deve riconoscere nella sua lingua
 * ("ah, la Siciliana"), e sono poche decine. La variante invece e' la chiave con cui la
 * cerchera' su Lichess o su YouTube, e tradurla vorrebbe dire renderla introvabile —
 * oltre a richiedere di tradurre tremila nomi, quasi tutti di coda lunghissima.
 *
 * Nel PGN il nome resta interamente inglese: li' il tag `Opening` serve agli altri
 * programmi, non a noi.
 *
 * La tabella copre le famiglie che compaiono davvero nel nostro libro di aperture
 * (sessantasei), non tutto il dizionario ECO: quello che non c'e' resta in inglese, che
 * e' un peggioramento accettabile e mai un errore.
 */

type Translated = Record<string, string>;

const IT: Translated = {
  'Sicilian Defense': 'Difesa Siciliana',
  'Italian Game': 'Partita Italiana',
  'French Defense': 'Difesa Francese',
  'Queen’s Pawn Game': 'Apertura di Donna',
  "Queen's Pawn Game": 'Apertura di Donna',
  'English Opening': 'Apertura Inglese',
  'Ruy Lopez': 'Ruy Lopez',
  'Caro-Kann Defense': 'Difesa Caro-Kann',
  "Queen's Gambit Declined": 'Gambetto di Donna Rifiutato',
  "Queen's Gambit Accepted": 'Gambetto di Donna Accettato',
  "Queen's Gambit": 'Gambetto di Donna',
  "Petrov's Defense": 'Difesa Petroff',
  'Scotch Game': 'Partita Scozzese',
  'Scandinavian Defense': 'Difesa Scandinava',
  'Indian Defense': 'Difesa Indiana',
  "King's Gambit Accepted": 'Gambetto di Re Accettato',
  "King's Gambit Declined": 'Gambetto di Re Rifiutato',
  "King's Gambit": 'Gambetto di Re',
  'Zukertort Opening': 'Apertura Zukertort',
  'Philidor Defense': 'Difesa Philidor',
  'Center Game': 'Partita di Centro',
  'Center Game Accepted': 'Partita di Centro Accettata',
  'Vienna Game': 'Partita Viennese',
  'Vienna Gambit, with Max Lange Defense': 'Gambetto Viennese, con Difesa Max Lange',
  'Four Knights Game': 'Partita dei Quattro Cavalli',
  'Three Knights Game': 'Partita dei Tre Cavalli',
  "King's Pawn Game": 'Apertura di Re',
  "King's Knight Opening": 'Apertura del Cavallo di Re',
  "Bishop's Opening": 'Apertura dell’Alfiere',
  'Pirc Defense': 'Difesa Pirc',
  'Modern Defense': 'Difesa Moderna',
  'Nimzowitsch Defense': 'Difesa Nimzowitsch',
  'Benoni Defense': 'Difesa Benoni',
  'Benko Gambit': 'Gambetto Benko',
  'Slav Defense': 'Difesa Slava',
  'Semi-Slav Defense': 'Difesa Semi-Slava',
  'Slav Indian': 'Slava Indiana',
  'Englund Gambit': 'Gambetto Englund',
  'Englund Gambit Declined': 'Gambetto Englund Rifiutato',
  'Blackmar-Diemer Gambit': 'Gambetto Blackmar-Diemer',
  'Blackmar-Diemer Gambit Accepted': 'Gambetto Blackmar-Diemer Accettato',
  "King's Indian Defense": 'Difesa Est-Indiana',
  "King's Indian Attack": 'Attacco Est-Indiano',
  'East Indian Defense': 'Difesa Indiana Orientale',
  'Old Indian Defense': 'Antica Indiana',
  'Nimzo-Indian Defense': 'Difesa Nimzo-Indiana',
  'Ponziani Opening': 'Apertura Ponziani',
  'Rat Defense': 'Difesa Rat',
  'Danish Gambit': 'Gambetto Danese',
  'Danish Gambit Accepted': 'Gambetto Danese Accettato',
  'Danish Gambit Declined': 'Gambetto Danese Rifiutato',
  'Trompowsky Attack': 'Attacco Trompowsky',
  'Torre Attack': 'Attacco Torre',
  'Richter-Veresov Attack': 'Attacco Richter-Veresov',
  'Réti Opening': 'Apertura Réti',
  'Rapport-Jobava System': 'Sistema Rapport-Jobava',
  'Rapport-Jobava System, with e6': 'Sistema Rapport-Jobava, con e6',
  'London System': 'Sistema Londra',
  'Yusupov-Rubinstein System': 'Sistema Yusupov-Rubinstein',
  'Kangaroo Defense': 'Difesa Canguro',
  'Horwitz Defense': 'Difesa Horwitz',
  'English Defense': 'Difesa Inglese',
  'Grünfeld Defense': 'Difesa Grünfeld',
  'Tarrasch Defense': 'Difesa Tarrasch',
  'Czech Defense': 'Difesa Ceca',
  'Alekhine Defense': 'Difesa Alekhine',
  'Lion Defense': 'Difesa Lion',
};

const FR: Translated = {
  'Sicilian Defense': 'Défense sicilienne',
  'Italian Game': 'Partie italienne',
  'French Defense': 'Défense française',
  "Queen's Pawn Game": 'Partie du pion dame',
  'English Opening': 'Ouverture anglaise',
  'Ruy Lopez': 'Ruy Lopez',
  'Caro-Kann Defense': 'Défense Caro-Kann',
  "Queen's Gambit Declined": 'Gambit dame refusé',
  "Queen's Gambit Accepted": 'Gambit dame accepté',
  "Queen's Gambit": 'Gambit dame',
  "Petrov's Defense": 'Défense Petrov',
  'Scotch Game': 'Partie écossaise',
  'Scandinavian Defense': 'Défense scandinave',
  'Indian Defense': 'Défense indienne',
  "King's Gambit Accepted": 'Gambit du roi accepté',
  "King's Gambit Declined": 'Gambit du roi refusé',
  "King's Gambit": 'Gambit du roi',
  'Zukertort Opening': 'Ouverture Zukertort',
  'Philidor Defense': 'Défense Philidor',
  'Center Game': 'Partie du centre',
  'Center Game Accepted': 'Partie du centre acceptée',
  'Vienna Game': 'Partie viennoise',
  'Vienna Gambit, with Max Lange Defense': 'Gambit viennois, avec défense Max Lange',
  'Four Knights Game': 'Partie des quatre cavaliers',
  'Three Knights Game': 'Partie des trois cavaliers',
  "King's Pawn Game": 'Partie du pion roi',
  "King's Knight Opening": 'Ouverture du cavalier roi',
  "Bishop's Opening": 'Ouverture du fou',
  'Pirc Defense': 'Défense Pirc',
  'Modern Defense': 'Défense moderne',
  'Nimzowitsch Defense': 'Défense Nimzowitsch',
  'Benoni Defense': 'Défense Benoni',
  'Benko Gambit': 'Gambit Benko',
  'Slav Defense': 'Défense slave',
  'Semi-Slav Defense': 'Défense semi-slave',
  'Slav Indian': 'Slave indienne',
  'Englund Gambit': 'Gambit Englund',
  'Englund Gambit Declined': 'Gambit Englund refusé',
  'Blackmar-Diemer Gambit': 'Gambit Blackmar-Diemer',
  'Blackmar-Diemer Gambit Accepted': 'Gambit Blackmar-Diemer accepté',
  "King's Indian Defense": 'Défense est-indienne',
  "King's Indian Attack": 'Attaque est-indienne',
  'East Indian Defense': 'Défense indienne de l’est',
  'Old Indian Defense': 'Ancienne indienne',
  'Nimzo-Indian Defense': 'Défense nimzo-indienne',
  'Ponziani Opening': 'Ouverture Ponziani',
  'Rat Defense': 'Défense Rat',
  'Danish Gambit': 'Gambit danois',
  'Danish Gambit Accepted': 'Gambit danois accepté',
  'Danish Gambit Declined': 'Gambit danois refusé',
  'Trompowsky Attack': 'Attaque Trompowsky',
  'Torre Attack': 'Attaque Torre',
  'Richter-Veresov Attack': 'Attaque Richter-Veresov',
  'Réti Opening': 'Ouverture Réti',
  'Rapport-Jobava System': 'Système Rapport-Jobava',
  'Rapport-Jobava System, with e6': 'Système Rapport-Jobava, avec e6',
  'London System': 'Système de Londres',
  'Yusupov-Rubinstein System': 'Système Yusupov-Rubinstein',
  'Kangaroo Defense': 'Défense kangourou',
  'Horwitz Defense': 'Défense Horwitz',
  'English Defense': 'Défense anglaise',
  'Grünfeld Defense': 'Défense Grünfeld',
  'Tarrasch Defense': 'Défense Tarrasch',
  'Czech Defense': 'Défense tchèque',
  'Alekhine Defense': 'Défense Alekhine',
  'Lion Defense': 'Défense Lion',
};

const TABLES: Partial<Record<string, Translated>> = { it: IT, fr: FR };

/**
 * Il nome con la famiglia tradotta, se la conosciamo. In inglese, e per le famiglie che
 * non sono in tabella, torna il nome come sta nel dizionario.
 */
export function localizeOpening(name: string): string {
  const table = TABLES[locale()];
  if (!table) return name;
  const colon = name.indexOf(':');
  const family = (colon === -1 ? name : name.slice(0, colon)).trim();
  const translated = table[family];
  if (!translated) return name;
  return colon === -1 ? translated : translated + name.slice(colon);
}
