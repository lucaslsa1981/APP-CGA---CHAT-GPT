const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8080);
const localSync = require('./local-sync.cjs')(root, port);
const pages = new Set(fs.readdirSync(root).filter(name => name.endsWith('.html')));
const allowed = new Set([...pages, 'logo-pcce.png', 'cga-auth.js', 'cga-export.js', 'cga-dados.js']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const reply = (status, message) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : message); };
  if (req.url.split('?')[0] === '/__local/state') return localSync.handle(req, res);
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return reply(405, 'Método não permitido'); }
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
  catch { return reply(400, 'Endereço inválido'); }
  if (name.includes('\\') || name.includes('\0') || name.split('/').some(part => part.startsWith('.'))) return reply(403, 'Acesso negado');
  if (!allowed.has(name) && !(name.startsWith('assets/') && mime[path.extname(name).toLowerCase()])) return reply(404, 'Arquivo não encontrado');
  const file = name === 'cga-dados.js' ? localSync.published() : path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) return reply(403, 'Acesso negado');
  fs.realpath(file, (error, real) => {
    if (error || !real.startsWith(root + path.sep)) return reply(404, 'Arquivo não encontrado');
    fs.stat(real, (error, stat) => {
      if (error || !stat.isFile()) return reply(404, 'Arquivo não encontrado');
      if (name.endsWith('.html') || name === 'cga-auth.js') {
        return fs.readFile(real, 'utf8', (error, text) => {
          if (error) return reply(500, 'Falha ao abrir a página');
          const body = localSync.transform(text);
          res.writeHead(200, { 'Content-Type': mime[path.extname(name)], 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
          res.end(req.method === 'HEAD' ? undefined : body);
        });
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(name).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(real);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    });
  });
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `A porta ${port} está ocupada. Feche a outra instância ou configure PORT.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`APP CGA em http://127.0.0.1:${port}\nMantenha este terminal aberto. Ctrl+C encerra o servidor.`));
