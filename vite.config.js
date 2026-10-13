import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const manualPath = resolve(process.cwd(), 'docs', 'Manual_de_Usuario_SIGEC.html');

function serveUserManual() {
  return {
    name: 'serve-user-manual',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/Manual_de_Usuario_SIGEC.html') {
          next();
          return;
        }

        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(readFileSync(manualPath));
      });
    },
    closeBundle() {
      const outputDirectory = resolve(process.cwd(), 'dist');
      mkdirSync(outputDirectory, { recursive: true });
      copyFileSync(manualPath, resolve(outputDirectory, 'Manual_de_Usuario_SIGEC.html'));
    }
  };
}

export default defineConfig({
  plugins: [react(), serveUserManual()],
  server: {
    port: 3000
  }
});