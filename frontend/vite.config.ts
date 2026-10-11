import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The artery config is shared with the backend: config/arteries.json is the single source of truth.
export default defineConfig({
  plugins: [react()],
  resolve: {alias: {'@config': path.resolve(__dirname, '../config')}},
  server: {port: 5173, fs: {allow: ['..']}},
  build: {chunkSizeWarningLimit: 1500},
  test: {environment: 'node'},
});
