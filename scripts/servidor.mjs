import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const porta = Number(process.env.PORT || 4178);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // normalize + prefixo impedem que "../" saia da pasta do projeto
    let alvo = normalize(join(raiz, caminho));
    if (!alvo.startsWith(raiz)) {
      res.writeHead(403).end('403');
      return;
    }
    const info = await stat(alvo).catch(() => null);
    if (!info || info.isDirectory()) alvo = join(alvo, 'index.html');
    const corpo = await readFile(alvo);
    res.writeHead(200, {
      'content-type': TIPOS[extname(alvo)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(corpo);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}).listen(porta, () => console.log(`Radar de Eventos em http://localhost:${porta}`));
