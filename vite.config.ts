import { defineConfig } from 'vite';

// base './' : fonctionne à la fois pour GitHub Pages (sous-chemin) et Capacitor (file://)
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
