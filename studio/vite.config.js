import {defineConfig} from 'vite';

export default defineConfig({
  server: {
    proxy: Object.fromEntries(
      ['/api', '/legacy', '/app.js', '/style.css'].map(path =>
        [path, {target: 'http://127.0.0.1:8080', changeOrigin: true}])
    ),
  },
});
