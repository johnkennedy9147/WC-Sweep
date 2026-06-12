import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only: serve /data/* from the repo's data dir, mirroring how production
// reads the snapshot from the raw GitHub URL rather than the deployed bundle.
const serveDataDir = {
  name: 'serve-data-dir',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/data', (req, res, next) => {
      const name = path.basename(req.url.split('?')[0]);
      const file = path.join('data', name);
      if (name.endsWith('.json') && fs.existsSync(file)) {
        res.setHeader('Content-Type', 'application/json');
        res.end(fs.readFileSync(file));
      } else {
        next();
      }
    });
  },
};

// Project site served at johnkennedy9147.github.io/WC-Sweep/
export default defineConfig({
  base: '/WC-Sweep/',
  plugins: [react(), serveDataDir],
});
