import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// dev: proxy /api to the Express server on :3000
export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
