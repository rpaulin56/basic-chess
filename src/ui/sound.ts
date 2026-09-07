/**
 * Il richiamo della Nonna: due note brevi, quando interviene.
 *
 * Serve a un problema preciso e solo a quello. Su telefono lo schermo e' in colonna,
 * il pannello della Nonna finisce sotto la scacchiera e quindi sotto la piega: si
 * gioca una mossa, lei parla, e non se ne sa niente. La freccia sulla scacchiera lo
 * dice all'occhio, questo lo dice all'orecchio.
 *
 * Sintetizzato e non un file audio, per tre motivi che si sommano: nessun byte da
 * scaricare (l'applicazione e' gia' un motore da 7 MB), nessuna licenza da citare in
 * un programma che ne cita gia' parecchie, e la possibilita' di tenerlo davvero
 * discreto — un campione trovato in giro e' quasi sempre troppo squillante per una
 * cosa che accade a ogni errore.
 *
 * Due note discendenti e non ascendenti: una coppia che sale suona come "fatto!", una
 * che scende come "un momento". Qui la seconda e' quella giusta — la Nonna non ti sta
 * premiando, ti sta fermando. E scende di una terza minore, l'intervallo con cui in
 * mezzo mondo si chiama qualcuno per nome da lontano.
 */

/**
 * Il contesto audio si crea alla PRIMA riproduzione, non all'avvio.
 *
 * I browser bloccano l'audio finche' l'utente non ha interagito con la pagina, e un
 * contesto creato al caricamento nasce sospeso e resta muto. Creato qui invece nasce
 * gia' sbloccato: quando la Nonna interviene, l'utente ha appena mosso un pezzo.
 */
let context: AudioContext | null = null;

/** Le due note: LA4 e FA4, cioe' una terza minore discendente. */
const NOTES = [440, 349.23];

export function playChime(): void {
  try {
    context ??= new AudioContext();
    // Sbloccato per sicurezza: se la pagina e' tornata in primo piano dopo essere
    // stata in secondo, il contesto puo' essere sospeso.
    if (context.state === 'suspended') void context.resume();

    const now = context.currentTime;
    NOTES.forEach((frequency, index) => {
      const start = now + index * 0.13;
      const oscillator = context!.createOscillator();
      // Onda sinusoidale: nessuna armonica, quindi nessuna asprezza. Un'onda quadra o
      // a dente di sega a questo volume suonerebbe come una sveglia.
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      const gain = context!.createGain();
      // Attacco e rilascio graduali. Un gradino sul volume produce un "click" udibile
      // (una discontinuita' nel segnale), e sarebbe proprio la parte fastidiosa.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);

      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    });
  } catch {
    // Audio non disponibile (contesto negato, dispositivo senza uscita): si gioca lo
    // stesso. Il suono e' un di piu', la freccia sulla scacchiera resta.
  }
}
