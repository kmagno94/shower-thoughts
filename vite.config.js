import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8'));

// Same setup as Speak to Prompt. The app's source lives in app/.
// GitHub Pages serves it at /shower-thoughts/, so the deploy workflow passes
// that in BASE_PATH; locally it stays "/".
// STAGING=1 builds the staging copy (STAGING badge, "stg:" storage keys), see app/lib/env.js.
export default defineConfig({
  root: path.join(here, 'app'),
  envDir: here,
  base: process.env.BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __STAGING__: JSON.stringify(process.env.STAGING === '1')
  },
  plugins: [svelte()],
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, target: 'safari16' }
});
