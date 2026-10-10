import { defineConfig } from 'vite';

// Relative asset URLs work on custom-domain roots and project subpaths alike.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
