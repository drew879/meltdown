import { defineConfig } from 'vite';

// The game is served from https://drew879.github.io/meltdown/, so every path
// has to work under that subpath in development too.
export default defineConfig({
  base: '/meltdown/',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2022' },
});
