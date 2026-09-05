import { defineConfig } from 'vite';

// Gli header COOP/COEP servono a SharedArrayBuffer, che a sua volta serve a
// stockfish.wasm in versione multi-thread (fase 2). Li mettiamo gia' ora in dev
// cosi' il comportamento locale coincide con quello del VPS (vedi deploy/Caddyfile),
// invece di scoprire la differenza il giorno in cui si integra il motore.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // host: true -> il dev server e' raggiungibile dagli altri dispositivi della LAN
  server: { host: true, port: 5190, headers: crossOriginIsolation },
  preview: { host: true, port: 5191, headers: crossOriginIsolation },
  build: { target: 'es2022' },
});
