const fs = require('node:fs');
const vm = require('node:vm');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const local = require('./local-sync.cjs')(root, 8080);
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html') && file !== 'index.html')) {
  const text = local.transform(fs.readFileSync(path.join(root, file), 'utf8'));
  const manifest = JSON.parse(text.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
  const template = JSON.parse(text.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
  assert(template.includes('window.CGALocal ='));
  let found = false;
  for (const resource of Object.values(manifest)) {
    if (!/javascript/.test(resource.mime)) continue;
    let buffer = Buffer.from(resource.data, 'base64');
    if (resource.compressed) buffer = zlib.gunzipSync(buffer);
    const source = buffer.toString();
    if (!source.includes('showDirectoryPicker')) continue;
    new vm.Script(source);
    assert(source.includes('if (window.CGALocal) return Promise.resolve(window.CGALocal.handle)'));
    assert(source.includes('Promise.resolve(window.CGALocal.handle) : idbGet'));
    found = true;
  }
  assert(found, `Autenticação não encontrada: ${file}`);
  console.log(`OK sincronização automática: ${file}`);
}
