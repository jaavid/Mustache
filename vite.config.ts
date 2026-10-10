import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/Mustache/' : '/',
  build: { target: 'es2022' },
}));
