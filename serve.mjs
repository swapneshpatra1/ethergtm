import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = 3000;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  let file = join(__dirname, url);

  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    // not a directory (or doesn't exist) — fall through to the readFile attempt below
  }

  const type = mime[extname(file).toLowerCase()] ?? 'application/octet-stream';

  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}).listen(PORT, () => console.log(`etherGTM dev server → http://localhost:${PORT}`));
