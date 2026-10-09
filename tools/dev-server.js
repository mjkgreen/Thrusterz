// Local server: the game's static files plus the API on one port, with the
// in-memory store unless Upstash env vars are set.   npm run dev
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { routes } = require('../api/_lib/core');

const root = path.join(__dirname, '..');
const port = +process.env.PORT || 8080;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = /^\/api\/([a-z]+)$/.exec(url.pathname);
  if (m && routes[m[1]]) return routes[m[1]](req, res);
  let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root) || /[\\/](node_modules|ios|android|\.git)[\\/]/.test(file)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
if (require.main === module) server.listen(port, () => console.log(`Thrusterz on http://localhost:${port} (api store: ${require('../api/_lib/store').getStore().kind})`));
module.exports = server;
