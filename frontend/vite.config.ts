import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  /** Electron loadFile 必须用相对路径，否则打包后 /assets 会指向 C:/assets → 白屏 */
  base: './',
  plugins: [tailwindcss(), react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: false,
  },
});
