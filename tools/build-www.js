// Copies the game into www/, the folder Capacitor packages into the app.
//   npm run build:www   (then: npx cap sync ios)
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'icon.svg', 'privacy.html', 'css', 'js', 'fonts', 'img'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
let n = 0;
const copy = (src, dst) => {
  if (fs.statSync(src).isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f)); }
  else { fs.copyFileSync(src, dst); n++; }
};
for (const f of INCLUDE) if (fs.existsSync(path.join(root, f))) copy(path.join(root, f), path.join(out, f));
console.log(`www/: ${n} files`);
