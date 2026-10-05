const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

module.exports = function localSync(root, port) {
  const token = crypto.randomBytes(32).toString('hex');
  const directory = path.join(root, '.local');
  const state = path.join(directory, 'cga-dados.js');
  const origin = `http://127.0.0.1:${port}`;
  const bootstrap = `<script>
window.CGALocal = (function () {
  var token = ${JSON.stringify(token)};
  function request(method, data) {
    return fetch('/__local/state', { method: method, headers: { 'X-CGA-Local': token, 'Content-Type': 'text/plain' }, body: data }).then(function (r) { if (!r.ok) throw new Error('Falha na sincronização local (' + r.status + ')'); return r.text(); });
  }
  var handle = { name: 'Pasta do aplicativo · armazenamento automático', queryPermission: function () { return Promise.resolve('granted'); }, requestPermission: function () { return Promise.resolve('granted'); }, getFileHandle: function (name) {
    if (name === 'Portal CGA.dc.html') return Promise.resolve({});
    if (name !== 'cga-dados.js' && name !== 'cga-estado.json') return Promise.reject(new Error('Arquivo não permitido'));
    return Promise.resolve({ getFile: function () { return request('GET').then(function (text) { return { text: function () { return Promise.resolve(text); } }; }); }, createWritable: function () { var text; return Promise.resolve({ write: function (data) { text = data; return Promise.resolve(); }, close: function () { return request('PUT', text); } }); } });
  } };
  return { handle: handle };
})();
</script>`;
  const replacements = [
    ['A publicação automática funciona quando o Portal é aberto pela pasta compartilhada da rede. Nesta página (visualização ou internet), os dados não são publicados.', 'Os dados são salvos automaticamente na pasta de onde o aplicativo foi iniciado. Não é necessário escolher pastas no navegador.'],
    ['Na primeira entrada, o navegador pedirá para escolher uma pasta: escolha a pasta compartilhada onde está este Portal. É uma única vez. Depois disso, tudo que o gestor master fizer é publicado sozinho para os usuários.', 'Neste ambiente local, o servidor salva os dados automaticamente. Entre com seu perfil; não é necessário escolher pastas.'],
    ['function dir(interactive) {', 'function dir(interactive) {\n    if (window.CGALocal) return Promise.resolve(window.CGALocal.handle);'],
    ['supported: !!window.showDirectoryPicker,', 'supported: !!window.CGALocal || !!window.showDirectoryPicker,'],
    ["status: function () { return idbGet('dir')", "status: function () { if (window.CGALocal) return Promise.resolve({ linked: true, granted: true, name: window.CGALocal.handle.name }); return idbGet('dir')"],
    ['link: function () {', 'link: function () {\n      if (window.CGALocal) return connect();'],
    ['function connect() {', "function connect() {\n    if (window.CGALocal) { _h = window.CGALocal.handle; _perm = 'granted'; syncEvt(); return Promise.resolve({ ok: true, name: _h.name }); }"],
    ["idbGet('dir').then(function (h) { _h = h && h.queryPermission", "(window.CGALocal ? Promise.resolve(window.CGALocal.handle) : idbGet('dir')).then(function (h) { _h = h && h.queryPermission"]
  ];
  return {
    transform(text) {
      const patch = source => {
      for (const [before, after] of replacements) {
        source = source.split(before).join(after);
        // The HTML bundler also stores source code inside JSON strings.
        const escaped = JSON.stringify(before).slice(1, -1);
        if (escaped !== before) source = source.split(escaped).join(JSON.stringify(after).slice(1, -1));
      }
      return source;
      };
      text = text.replace(/(<script type="__bundler\/manifest">)([\s\S]*?)(<\/script>)/g, (_, start, json, end) => {
        const manifest = JSON.parse(json);
        for (const resource of Object.values(manifest)) {
          if (!/javascript/.test(resource.mime)) continue;
          let buffer = Buffer.from(resource.data, 'base64');
          if (resource.compressed) buffer = zlib.gunzipSync(buffer);
          const source = buffer.toString('utf8');
          if (!source.includes('showDirectoryPicker')) continue;
          buffer = Buffer.from(patch(source));
          resource.data = (resource.compressed ? zlib.gzipSync(buffer) : buffer).toString('base64');
        }
        return start + JSON.stringify(manifest) + end;
      });
      text = text.replace(/(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/g, (_, start, json, end) => {
        const template = patch(JSON.parse(json)).replace(/<head\b[^>]*>/i, match => match + bootstrap);
        return start + JSON.stringify(template).replace(/<\//g, '<\\/') + end;
      });
      // Manifest resources and templates have already been patched above.
      if (!text.includes('__bundler/manifest')) text = patch(text);
      const head = /<head\b[^>]*>/i;
      return text.replace(head, match => match + bootstrap);
    },
    published() { return fs.existsSync(state) ? state : path.join(root, 'cga-dados.js'); },
    handle(req, res) {
      const reply = (status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(text); };
      if (req.headers.host !== `127.0.0.1:${port}` || (req.headers.origin && req.headers.origin !== origin) || req.headers['x-cga-local'] !== token) return reply(403, 'Acesso negado');
      if (req.method === 'GET') {
        return fs.readFile(this.published(), 'utf8', (error, text) => reply(error ? 404 : 200, error ? 'Sem publicação' : text));
      }
      if (req.method !== 'PUT') return reply(405, 'Método não permitido');
      let size = 0, chunks = [];
      req.on('data', chunk => { size += chunk.length; if (size > 100 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          const match = /window\.CGA_DADOS\s*=\s*([\s\S]*);\s*$/.exec(text);
          const data = JSON.parse(match ? match[1] : text);
          if (data.tipo !== 'cga-estado' || !data.chaves || typeof data.chaves !== 'object' || Array.isArray(data.chaves)) return reply(400, 'Estado inválido');
          const script = 'window.CGA_DADOS = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';\n';
          fs.mkdirSync(directory, { recursive: true });
          fs.writeFileSync(state + '.tmp', script, 'utf8');
          fs.renameSync(state + '.tmp', state);
          reply(200, 'Estado salvo');
        } catch (error) { reply(error instanceof SyntaxError ? 400 : 500, 'Não foi possível salvar o estado local'); }
      });
    }
  };
};
