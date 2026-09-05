import { defineConfig } from 'vite';

// Nessun header speciale: usiamo Stockfish single-thread (vedi
// src/engine/browserTransport.ts per il perche'), quindi niente SharedArrayBuffer e
// niente COOP/COEP — ne' qui ne' sul server di produzione.
export default defineConfig({
  // host: true -> il dev server e' raggiungibile dagli altri dispositivi della LAN
  server: { host: true, port: 5190 },
  preview: { host: true, port: 5191 },
  build: { target: 'es2022' },
});
